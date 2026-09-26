const GRAPH="https://graph.facebook.com";
async function json<T>(response:Response):Promise<T>{const data=await response.json() as T&{error?:{message?:string}};if(!response.ok||data.error) throw new Error(data.error?.message||`Instagram API failed (HTTP ${response.status}).`);return data;}

export async function createInstagramReelContainer(input:{igUserId:string;pageAccessToken:string;videoUrl:string;caption?:string;shareToFeed?:boolean}){
 const p=new URLSearchParams({media_type:"REELS",video_url:input.videoUrl,access_token:input.pageAccessToken,share_to_feed:String(Boolean(input.shareToFeed))});
 if(input.caption) p.set("caption",input.caption);
 return json<{id:string}>(await fetch(`${GRAPH}/${input.igUserId}/media?${p}`,{method:"POST"}));
}
export async function getInstagramContainerStatus(input:{containerId:string;pageAccessToken:string}){
 const p=new URLSearchParams({fields:"status_code,status",access_token:input.pageAccessToken});
 return json<{id:string;status_code:string;status?:string}>(await fetch(`${GRAPH}/${input.containerId}?${p}`));
}
export async function publishInstagramReel(input:{igUserId:string;pageAccessToken:string;containerId:string}){
 const p=new URLSearchParams({creation_id:input.containerId,access_token:input.pageAccessToken});
 return json<{id:string}>(await fetch(`${GRAPH}/${input.igUserId}/media_publish?${p}`,{method:"POST"}));
}
