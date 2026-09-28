import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AssetJob, GeneratedAsset } from "../../shared/content-factory";
import type { AssetGenerationContext, AssetProvider } from "../content-asset-provider";
import { getReplicateApiToken } from "../settings";

type Prediction = { id:string; status:string; output?:unknown; error?:string };
const REQUEST_TIMEOUT_MS = 30_000;
const PREDICTION_TIMEOUT_MS = 6 * 60_000;
const MAX_VIDEO_BYTES = 256 * 1024 * 1024;
const sleep = (ms:number) => new Promise<void>(resolve => setTimeout(resolve,ms));

function mime(filePath:string) {
  const ext=path.extname(filePath).toLowerCase();
  return ext===".png"?"image/png":ext===".webp"?"image/webp":"image/jpeg";
}
async function dataUrl(filePath:string) {
  const bytes=await readFile(filePath);
  return `data:${mime(filePath)};base64,${bytes.toString("base64")}`;
}
export function referenceVideoInput(model:string,prompt:string,image:string) {
  if(model==="kwaivgi/kling-v2.1")return {prompt,start_image:image,duration:5};
  return {prompt,image,aspect_ratio:"9:16"};
}
export function validateReplicateModel(model:string):string {
  if(!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*\/[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(model)) {
    throw new Error("Replicate video model must be a valid owner/model identifier.");
  }
  return model;
}
export function validateReplicateVideoUrl(value:string):URL {
  let url:URL;
  try { url=new URL(value); } catch { throw new Error("Replicate video output URL is invalid."); }
  if(url.protocol!=="https:" || url.username || url.password || url.port && url.port!=="443") {
    throw new Error("Replicate video output must use an HTTPS URL.");
  }
  const host=url.hostname.toLowerCase();
  if(host!=="replicate.delivery" && !host.endsWith(".replicate.delivery") &&
     host!=="replicate.com" && !host.endsWith(".replicate.com")) {
    throw new Error("Replicate video output URL is not on an approved Replicate delivery host.");
  }
  return url;
}
async function downloadVideo(url:string):Promise<Uint8Array> {
  validateReplicateVideoUrl(url);
  const response=await fetch(url,{signal:AbortSignal.timeout(REQUEST_TIMEOUT_MS),redirect:"manual"});
  if(!response.ok)throw new Error(`Replicate video download failed: ${response.status}`);
  if(Number(response.headers.get("content-length")??0)>MAX_VIDEO_BYTES) {
    throw new Error("Replicate video output exceeds the 256 MB limit.");
  }
  if(!response.body)throw new Error("Replicate returned an empty video response.");
  const reader=response.body.getReader();
  const chunks:Uint8Array[]=[];let length=0;
  try {
    while(true) {
      const {done,value}=await reader.read();
      if(done)break;
      length+=value.byteLength;
      if(length>MAX_VIDEO_BYTES)throw new Error("Replicate video output exceeds the 256 MB limit.");
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(()=>{}); }
  const bytes=new Uint8Array(length);
  let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  // ISO Base Media File Format ('ftyp'); MP4 brands vary across codecs.
  if(length<12 || String.fromCharCode(...bytes.slice(4,8))!=="ftyp") {
    throw new Error("Replicate returned data that is not an MP4 video.");
  }
  return bytes;
}
export class ReplicateReferenceVideoProvider implements AssetProvider {
  readonly id="replicate-reference-video";
  constructor(private readonly model=process.env.REPLICATE_VIDEO_MODEL?.trim()||"") {}
  supports(kind:AssetJob["kind"]) {return kind==="video"&&Boolean(this.model);}
  async generate(job:AssetJob,context:AssetGenerationContext):Promise<GeneratedAsset> {
    if(!this.model)throw new Error("Configure a Replicate reference-image video model in AI Video Settings.");
    if(!job.referenceImagePath)throw new Error("Reference-aware video job is missing the real product image.");
    const token=await getReplicateApiToken();
    if(!token)throw new Error("Replicate API token is not configured.");
    const [owner,name]=validateReplicateModel(this.model).split("/");
    const apiUrl=`https://api.replicate.com/v1/models/${owner}/${name}/predictions`;
    const response=await fetch(apiUrl,{
      method:"POST",signal:AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json",Prefer:"wait"},
      body:JSON.stringify({input:referenceVideoInput(this.model,job.prompt,await dataUrl(job.referenceImagePath))})
    });
    if(!response.ok)throw new Error(`Replicate video prediction failed: ${response.status} ${(await response.text()).slice(0,400)}`);
    let prediction=await response.json() as Prediction;
    const started=Date.now();
    while(["starting","processing"].includes(prediction.status)) {
      if(Date.now()-started>=PREDICTION_TIMEOUT_MS)throw new Error("Replicate video generation timed out after six minutes.");
      if(!/^[a-zA-Z0-9_-]+$/.test(prediction.id))throw new Error("Replicate prediction ID is invalid.");
      await sleep(2000);
      // Build this API URL ourselves: never forward the bearer token to URLs supplied by a response.
      const poll=await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`,{
        signal:AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers:{Authorization:`Bearer ${token}`}
      });
      if(!poll.ok)throw new Error(`Replicate video polling failed: ${poll.status}`);
      prediction=await poll.json() as Prediction;
    }
    if(prediction.status!=="succeeded")throw new Error(prediction.error||`Replicate video prediction ended with ${prediction.status}`);
    const output=Array.isArray(prediction.output)?prediction.output[0]:prediction.output;
    if(typeof output!=="string")throw new Error("Replicate returned no downloadable video URL.");
    const bytes=await downloadVideo(output);
    await mkdir(context.workDir,{recursive:true});
    const filePath=path.join(context.workDir,`${job.id}.mp4`);
    await writeFile(filePath,bytes);
    return {id:`asset-${job.id}`,projectId:job.projectId,sceneId:job.sceneId,kind:"video",filePath,provider:this.id,mimeType:"video/mp4",source:"generated",sourcePrompt:job.prompt};
  }
}
