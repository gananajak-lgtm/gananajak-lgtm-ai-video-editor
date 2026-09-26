const GRAPH="https://graph.facebook.com";
const RUPLOAD="https://rupload.facebook.com";

async function json<T>(response:Response):Promise<T>{
 const data=await response.json() as T&{error?:{message?:string}};
 if(!response.ok||data.error) throw new Error(data.error?.message||`Facebook Reels API failed (HTTP ${response.status}).`);
 return data;
}

export async function createFacebookReel(input:{pageId:string;pageAccessToken:string}){
 const p=new URLSearchParams({access_token:input.pageAccessToken,upload_phase:"start"});
 return json<{video_id:string;upload_url?:string}>(await fetch(`${GRAPH}/${input.pageId}/video_reels?${p}`,{method:"POST"}));
}
export async function uploadFacebookLocalReel(input:{videoId:string;pageAccessToken:string;bytes:Uint8Array;uploadUrl?:string}){
 const response=await fetch(input.uploadUrl||`${RUPLOAD}/video-upload/v25.0/${input.videoId}`,{method:"POST",headers:{Authorization:`OAuth ${input.pageAccessToken}`,offset:"0",file_size:String(input.bytes.byteLength)},body:Buffer.from(input.bytes)});
 return json<{success:boolean}>(response);
}
export async function finishFacebookReel(input:{pageId:string;pageAccessToken:string;videoId:string;title?:string;description?:string}){
 const p=new URLSearchParams({access_token:input.pageAccessToken,video_id:input.videoId,upload_phase:"finish",video_state:"PUBLISHED"});
 if(input.title) p.set("title",input.title); if(input.description) p.set("description",input.description);
 return json<{success:boolean}>(await fetch(`${GRAPH}/${input.pageId}/video_reels?${p}`,{method:"POST"}));
}

export type FacebookReelStatus={video_status?:string;processing_phase?:{status?:string};uploading_phase?:{status?:string};publishing_phase?:{status?:string}};
export async function getFacebookReelStatus(input:{videoId:string;pageAccessToken:string}){
 const p=new URLSearchParams({fields:"status",access_token:input.pageAccessToken});
 return json<{id:string;status?:FacebookReelStatus}>(await fetch(`${GRAPH}/${input.videoId}?${p}`));
}
export function classifyFacebookReelStatus(status?:FacebookReelStatus){
 const values=[status?.video_status,status?.uploading_phase?.status,status?.processing_phase?.status,status?.publishing_phase?.status].filter(Boolean).map((value)=>String(value).toLowerCase());
 if(values.some((value)=>value.includes("error")||value.includes("fail"))) return "failed" as const;
 if(values.some((value)=>value.includes("ready")||value.includes("complete")||value.includes("published"))) return "ready" as const;
 return "processing" as const;
}
