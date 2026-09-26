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
export async function uploadFacebookLocalReel(input:{videoId:string;pageAccessToken:string;bytes:Uint8Array}){
 const response=await fetch(`${RUPLOAD}/video-upload/v25.0/${input.videoId}`,{method:"POST",headers:{Authorization:`OAuth ${input.pageAccessToken}`,offset:"0",file_size:String(input.bytes.byteLength)},body:Buffer.from(input.bytes)});
 return json<{success:boolean}>(response);
}
export async function finishFacebookReel(input:{pageId:string;pageAccessToken:string;videoId:string;title?:string;description?:string}){
 const p=new URLSearchParams({access_token:input.pageAccessToken,video_id:input.videoId,upload_phase:"finish",video_state:"PUBLISHED"});
 if(input.title) p.set("title",input.title); if(input.description) p.set("description",input.description);
 return json<{success:boolean}>(await fetch(`${GRAPH}/${input.pageId}/video_reels?${p}`,{method:"POST"}));
}
