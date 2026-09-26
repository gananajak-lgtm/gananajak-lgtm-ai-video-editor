import { open, stat } from "node:fs/promises";
import type { ContentBatchItem, TikTokPrivacyLevel } from "../shared/content-factory";

export type TikTokCreatorInfo = {
  creatorNickname?: string;
  privacyLevelOptions: TikTokPrivacyLevel[];
  commentDisabled?: boolean;
  duetDisabled?: boolean;
  stitchDisabled?: boolean;
  maxVideoPostDurationSec?: number;
};
export type TikTokPublishStatus = { status:string; failReason?:string; postIds:string[] };

type TikTokEnvelope<T> = { data?:T; error?:{ code?:string; message?:string; log_id?:string } };

const API="https://open.tiktokapis.com";
const MIN_CHUNK=5*1024*1024;
const MAX_CHUNK=64*1024*1024;
const MAX_VIDEO_SIZE=4*1024*1024*1024;

function apiError(action:string,status:number,envelope?:TikTokEnvelope<unknown>) {
  const detail=envelope?.error?.message || envelope?.error?.code;
  if(status===401) return new Error("TikTok authorization expired or is invalid. Reconnect TikTok and retry.");
  if(status===403) return new Error(`TikTok rejected ${action}. Check Content Posting API approval and granted scopes.${detail ? ` Details: ${detail}` : ""}`);
  if(status===429) return new Error("TikTok rate limit was reached. Wait and retry later.");
  return new Error(`TikTok ${action} failed (HTTP ${status}).${detail ? ` Details: ${detail}` : ""}`);
}

async function postJson<T>(url:string,accessToken:string,body:unknown):Promise<T> {
  const response=await fetch(url,{method:"POST",headers:{authorization:`Bearer ${accessToken}`,"content-type":"application/json; charset=UTF-8"},body:JSON.stringify(body)});
  const envelope=await response.json().catch(()=>({})) as TikTokEnvelope<T>;
  if(!response.ok || (envelope.error?.code && envelope.error.code!=="ok") || !envelope.data) throw apiError("request",response.status,envelope);
  return envelope.data;
}

export async function queryTikTokCreatorInfo(accessToken:string):Promise<TikTokCreatorInfo> {
  const data=await postJson<{ creator_nickname?:string; privacy_level_options?:TikTokPrivacyLevel[]; comment_disabled?:boolean; duet_disabled?:boolean; stitch_disabled?:boolean; max_video_post_duration_sec?:number }>(
    `${API}/v2/post/publish/creator_info/query/`,accessToken,{}
  );
  return {creatorNickname:data.creator_nickname,privacyLevelOptions:data.privacy_level_options ?? [],commentDisabled:data.comment_disabled,duetDisabled:data.duet_disabled,stitchDisabled:data.stitch_disabled,maxVideoPostDurationSec:data.max_video_post_duration_sec};
}

export function buildTikTokCaption(item:ContentBatchItem) {
  const plan=item.publish;
  return [plan?.caption?.trim() || plan?.description?.trim() || plan?.title?.trim(),...(plan?.hashtags ?? []).map(tag=>`#${tag.replace(/^#/,"")}`)].filter(Boolean).join("\n\n");
}

export function planTikTokChunks(videoSize:number) {
  if(!Number.isSafeInteger(videoSize) || videoSize<=0) throw new Error("TikTok video file is empty.");
  if(videoSize>MAX_VIDEO_SIZE) throw new Error("TikTok video must be 4 GB or smaller.");
  if(videoSize<=MAX_CHUNK) return {chunkSize:videoSize,totalChunkCount:1};
  const chunkSize=MAX_CHUNK;
  const totalChunkCount=Math.floor(videoSize/chunkSize);
  if(totalChunkCount<1 || totalChunkCount>1000) throw new Error("TikTok video requires an unsupported number of upload chunks.");
  const finalChunkSize=videoSize-chunkSize*(totalChunkCount-1);
  if(chunkSize<MIN_CHUNK || finalChunkSize>128*1024*1024) throw new Error("TikTok video cannot be split into valid upload chunks.");
  return {chunkSize,totalChunkCount};
}

export function validateTikTokMedia(input:{duration:number;sizeBytes:number;streams:Array<{codecType:string|null;width:number|null;height:number|null;fps:number|null}>;maxDurationSec?:number}) {
  if(input.sizeBytes<=0 || input.sizeBytes>MAX_VIDEO_SIZE) throw new Error("TikTok video must be non-empty and 4 GB or smaller.");
  if(input.maxDurationSec && input.duration>input.maxDurationSec+0.01) throw new Error(`TikTok creator limit is ${input.maxDurationSec} seconds, but this video is ${input.duration.toFixed(1)} seconds.`);
  const video=input.streams.find((stream)=>stream.codecType==="video");
  if(!video) throw new Error("TikTok upload requires a video stream.");
  if(video.width!==null && (video.width<360 || video.width>4096)) throw new Error("TikTok video width must be between 360 and 4096 pixels.");
  if(video.height!==null && (video.height<360 || video.height>4096)) throw new Error("TikTok video height must be between 360 and 4096 pixels.");
  if(video.fps!==null && (video.fps<23 || video.fps>60)) throw new Error("TikTok video frame rate must be between 23 and 60 FPS.");
}


export async function initTikTokDirectPost(input:{accessToken:string;item:ContentBatchItem;privacyLevel:TikTokPrivacyLevel;disableComment?:boolean;disableDuet?:boolean;disableStitch?:boolean;isAigc?:boolean;brandOrganic?:boolean;brandedContent?:boolean}) {
  if(!input.item.outputPath) throw new Error("Rendered video path is missing.");
  const info=await stat(input.item.outputPath).catch(()=>null);
  if(!info?.isFile() || info.size<=0) throw new Error("Rendered video file cannot be found or is empty.");
  const caption=buildTikTokCaption(input.item);
  if(caption.length>2200) throw new Error("TikTok caption must be 2200 characters or fewer.");
  const chunks=planTikTokChunks(info.size);
  const data=await postJson<{ publish_id:string; upload_url:string }>(`${API}/v2/post/publish/video/init/`,input.accessToken,{
    post_info:{title:caption,privacy_level:input.privacyLevel,disable_comment:Boolean(input.disableComment),disable_duet:Boolean(input.disableDuet),disable_stitch:Boolean(input.disableStitch),brand_content_toggle:Boolean(input.brandedContent),brand_organic_toggle:Boolean(input.brandOrganic),is_aigc:Boolean(input.isAigc)},
    source_info:{source:"FILE_UPLOAD",video_size:info.size,chunk_size:chunks.chunkSize,total_chunk_count:chunks.totalChunkCount}
  });
  if(!data.publish_id || !data.upload_url) throw new Error("TikTok did not return an upload session.");
  return {...data,videoSize:info.size,...chunks};
}

export async function uploadTikTokFile(input:{uploadUrl:string;filePath:string;videoSize:number;chunkSize:number;totalChunkCount:number}) {
  const handle=await open(input.filePath,"r");
  try {
    let offset=0;
    for(let index=0;index<input.totalChunkCount;index+=1){
      const remaining=input.videoSize-offset;
      const length=index===input.totalChunkCount-1 ? remaining : Math.min(input.chunkSize,remaining);
      const buffer=Buffer.allocUnsafe(length);
      const {bytesRead}=await handle.read(buffer,0,length,offset);
      if(bytesRead!==length) throw new Error("Could not read the complete TikTok upload chunk.");
      const end=offset+length-1;
      const response=await fetch(input.uploadUrl,{method:"PUT",headers:{"content-type":"video/mp4","content-length":String(length),"content-range":`bytes ${offset}-${end}/${input.videoSize}`},body:buffer});
      const expected=index===input.totalChunkCount-1 ? 201 : 206;
      if(response.status!==expected) throw apiError("media upload",response.status);
      offset=end+1;
    }
  } finally { await handle.close(); }
}

export async function fetchTikTokPublishStatus(accessToken:string,publishId:string):Promise<TikTokPublishStatus> {
  const data=await postJson<{status:string;fail_reason?:string;publicaly_available_post_id?:string[]}>(`${API}/v2/post/publish/status/fetch/`,accessToken,{publish_id:publishId});
  return {status:data.status,failReason:data.fail_reason,postIds:data.publicaly_available_post_id ?? []};
}


export async function waitForTikTokPublish(input:{accessToken:string;publishId:string;maxAttempts?:number;delayMs?:number}) {
  const maxAttempts=input.maxAttempts ?? 20, delayMs=input.delayMs ?? 1500;
  for(let attempt=0;attempt<maxAttempts;attempt+=1){
    const status=await fetchTikTokPublishStatus(input.accessToken,input.publishId);
    if(status.status==="PUBLISH_COMPLETE") return status;
    if(status.status==="FAILED") throw new Error(`TikTok publish failed.${status.failReason ? ` ${status.failReason}` : ""}`);
    if(attempt<maxAttempts-1) await new Promise((resolve)=>setTimeout(resolve,delayMs));
  }
  throw new Error("TikTok is still processing the video. Retry status later.");
}
