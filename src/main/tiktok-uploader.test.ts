import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { ContentBatchItem } from "../shared/content-factory";
import { buildTikTokCaption, fetchTikTokPublishStatus, initTikTokDirectPost, planTikTokChunks, queryTikTokCreatorInfo, uploadTikTokFile, waitForTikTokPublish, validateTikTokMedia } from "./tiktok-uploader";

const item=(outputPath:string):ContentBatchItem=>({id:"tt-1",brief:{topic:"TikTok test",format:"short",language:"en",targetDurationSeconds:30},status:"rendered",outputPath,publish:{status:"ready",title:"Caption",hashtags:["demo"],platforms:["tiktok"]}});

test("plans TikTok FILE_UPLOAD chunks within the documented 64 MB ceiling",()=>{
  assert.deepEqual(planTikTokChunks(4*1024*1024),{chunkSize:4*1024*1024,totalChunkCount:1});
  const plan=planTikTokChunks(130*1024*1024);
  assert.ok(plan.chunkSize<=64*1024*1024);
  assert.equal(plan.totalChunkCount,2);
});

test("builds editable TikTok caption metadata",()=>{
  assert.equal(buildTikTokCaption(item("video.mp4")),"Caption\n\n#demo");
});

test("mocks creator info, direct-post init, file upload and publish status",async(t)=>{
  const root=await mkdtemp(path.join(os.tmpdir(),"tiktok-uploader-test-")); t.after(()=>rm(root,{recursive:true,force:true}));
  const filePath=path.join(root,"video.mp4"); await writeFile(filePath,Buffer.from("fake-video"));
  const originalFetch=globalThis.fetch; const calls:Array<{url:string;init?:RequestInit}>=[];
  globalThis.fetch=(async(input:string|URL|Request,init?:RequestInit)=>{
    const url=typeof input==="string"?input:input instanceof URL?input.toString():input.url; calls.push({url,init});
    if(url.includes("creator_info")) return new Response(JSON.stringify({data:{creator_nickname:"Creator",privacy_level_options:["SELF_ONLY"],max_video_post_duration_sec:600},error:{code:"ok"}}),{status:200});
    if(url.includes("/video/init/")) return new Response(JSON.stringify({data:{publish_id:"v_pub_mock",upload_url:"https://upload.example.test/tiktok"},error:{code:"ok"}}),{status:200});
    if(url.includes("upload.example.test")) return new Response("",{status:201});
    return new Response(JSON.stringify({data:{status:"PUBLISH_COMPLETE",publicaly_available_post_id:["12345"]},error:{code:"ok"}}),{status:200});
  }) as typeof fetch; t.after(()=>{globalThis.fetch=originalFetch;});

  const creator=await queryTikTokCreatorInfo("token"); assert.deepEqual(creator.privacyLevelOptions,["SELF_ONLY"]);
  const session=await initTikTokDirectPost({accessToken:"token",item:item(filePath),privacyLevel:"SELF_ONLY"});
  const initBody=JSON.parse(String(calls[1].init?.body)); assert.equal(initBody.post_info.privacy_level,"SELF_ONLY"); assert.equal(initBody.source_info.source,"FILE_UPLOAD");
  await uploadTikTokFile({uploadUrl:session.upload_url,filePath,videoSize:session.videoSize,chunkSize:session.chunkSize,totalChunkCount:session.totalChunkCount});
  assert.equal(calls[2].init?.method,"PUT"); assert.equal((calls[2].init?.headers as Record<string,string>)["content-range"],"bytes 0-9/10");
  const status=await fetchTikTokPublishStatus("token",session.publish_id); assert.equal(status.status,"PUBLISH_COMPLETE"); assert.deepEqual(status.postIds,["12345"]);
});


test("polls TikTok processing until publish completes",async(t)=>{
  const originalFetch=globalThis.fetch; let count=0;
  globalThis.fetch=(async()=>{count+=1;return new Response(JSON.stringify({data:{status:count<2?"PROCESSING_UPLOAD":"PUBLISH_COMPLETE",publicaly_available_post_id:count<2?[]:["post-9"]},error:{code:"ok"}}),{status:200});}) as typeof fetch;
  t.after(()=>{globalThis.fetch=originalFetch;});
  const result=await waitForTikTokPublish({accessToken:"token",publishId:"pub",maxAttempts:3,delayMs:0});
  assert.equal(count,2); assert.deepEqual(result.postIds,["post-9"]);
});


test("rejects TikTok media outside creator and platform limits",()=>{
  assert.throws(()=>validateTikTokMedia({duration:301,sizeBytes:10_000_000,streams:[{codecType:"video",width:1080,height:1920,fps:30}],maxDurationSec:300}),/creator limit/i);
  assert.throws(()=>validateTikTokMedia({duration:30,sizeBytes:10_000_000,streams:[{codecType:"video",width:320,height:1920,fps:30}],maxDurationSec:300}),/width/i);
  assert.throws(()=>validateTikTokMedia({duration:30,sizeBytes:10_000_000,streams:[{codecType:"video",width:1080,height:1920,fps:61}],maxDurationSec:300}),/frame rate/i);
  assert.doesNotThrow(()=>validateTikTokMedia({duration:30,sizeBytes:10_000_000,streams:[{codecType:"video",width:1080,height:1920,fps:30}],maxDurationSec:300}));
});

test("plans documented TikTok chunks with a final chunk up to 128 MB",()=>{
  const size=130*1024*1024;
  assert.deepEqual(planTikTokChunks(size),{chunkSize:64*1024*1024,totalChunkCount:2});
  assert.throws(()=>planTikTokChunks(4*1024*1024*1024+1),/4 GB/i);
});
