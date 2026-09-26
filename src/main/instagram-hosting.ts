import { readFile } from "node:fs/promises";
import { stat } from "node:fs/promises";
import path from "node:path";

export type InstagramHostingConfig={uploadUrl:string;publicBaseUrl:string;bearerToken?:string};
export type HostedInstagramVideo={publicUrl:string;objectKey:string;size:number};

export function validateInstagramHostingConfig(config:InstagramHostingConfig){
 const upload=new URL(config.uploadUrl),base=new URL(config.publicBaseUrl);
 if(upload.protocol!=="https:"||base.protocol!=="https:") throw new Error("Instagram hosting endpoints must use HTTPS.");
 return {...config,uploadUrl:upload.toString(),publicBaseUrl:base.toString().replace(/\/$/,"")};
}
export async function uploadInstagramVideo(config:InstagramHostingConfig,filePath:string,objectKey:string):Promise<HostedInstagramVideo>{
 const safe=validateInstagramHostingConfig(config),info=await stat(filePath);if(!info.isFile()||!info.size) throw new Error("Instagram staging video is empty or missing.");
 const target=new URL(safe.uploadUrl);target.searchParams.set("key",objectKey);
 const headers:Record<string,string>={"content-type":"video/mp4","content-length":String(info.size)};if(safe.bearerToken)headers.authorization=`Bearer ${safe.bearerToken}`;
 const response=await fetch(target,{method:"PUT",headers,body:await readFile(filePath)});
 if(!response.ok) throw new Error(`Instagram staging upload failed (HTTP ${response.status}).`);
 return {publicUrl:`${safe.publicBaseUrl}/${objectKey.split("/").map(encodeURIComponent).join("/")}`,objectKey,size:info.size};
}
export function makeInstagramObjectKey(itemId:string,filePath:string){const ext=path.extname(filePath).toLowerCase()===".mp4"?".mp4":".mp4";return `instagram/${itemId}-${Date.now()}${ext}`;}
