import { readFile,mkdir,writeFile } from "node:fs/promises";import path from "node:path";import type { AssetJob,GeneratedAsset } from "../../shared/content-factory";import type { AssetGenerationContext,AssetProvider } from "../content-asset-provider";import { getReplicateApiToken } from "../settings";
type Prediction={id:string;status:string;output?:unknown;error?:string;urls?:{get?:string}};
function mime(filePath:string){const ext=path.extname(filePath).toLowerCase();return ext===".png"?"image/png":ext===".webp"?"image/webp":"image/jpeg";}
async function dataUrl(filePath:string){const bytes=await readFile(filePath);return `data:${mime(filePath)};base64,${bytes.toString("base64")}`;}
export function referenceVideoInput(model:string,prompt:string,image:string){
 if(model==="kwaivgi/kling-v2.1")return {prompt,start_image:image,duration:5};
 return {prompt,image,aspect_ratio:"9:16"};
}
export class ReplicateReferenceVideoProvider implements AssetProvider{
 readonly id="replicate-reference-video";
 constructor(private readonly model=process.env.REPLICATE_VIDEO_MODEL?.trim()||""){}
 supports(kind:AssetJob["kind"]){return kind==="video"&&Boolean(this.model);}
 async generate(job:AssetJob,context:AssetGenerationContext):Promise<GeneratedAsset>{
  if(!this.model)throw new Error("Configure REPLICATE_VIDEO_MODEL with a reference-image video model before generating AI product video.");
  if(!job.referenceImagePath)throw new Error("Reference-aware video job is missing the real product image.");
  const token=await getReplicateApiToken();if(!token)throw new Error("Replicate API token is not configured.");
  const [owner,name]=this.model.split("/");if(!owner||!name)throw new Error("REPLICATE_VIDEO_MODEL must be owner/model.");
  const response=await fetch(`https://api.replicate.com/v1/models/${owner}/${name}/predictions`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json",Prefer:"wait"},body:JSON.stringify({input:referenceVideoInput(this.model,job.prompt,await dataUrl(job.referenceImagePath))})});
  if(!response.ok)throw new Error(`Replicate video prediction failed: ${response.status} ${await response.text()}`);
  let prediction=await response.json() as Prediction;let polls=0;while(["starting","processing"].includes(prediction.status)){if(++polls>90)throw new Error("Replicate video generation timed out after three minutes.");await new Promise(resolve=>setTimeout(resolve,2000));const poll=await fetch(prediction.urls?.get||`https://api.replicate.com/v1/predictions/${prediction.id}`,{headers:{Authorization:`Bearer ${token}`}});if(!poll.ok)throw new Error(`Replicate video polling failed: ${poll.status}`);prediction=await poll.json() as Prediction;}
  if(prediction.status!=="succeeded")throw new Error(prediction.error||`Replicate video prediction ended with ${prediction.status}`);
  const output=Array.isArray(prediction.output)?prediction.output[0]:prediction.output;if(typeof output!=="string")throw new Error("Replicate returned no downloadable video URL.");
  const download=await fetch(output);if(!download.ok)throw new Error(`Replicate video download failed: ${download.status}`);await mkdir(context.workDir,{recursive:true});const filePath=path.join(context.workDir,`${job.id}.mp4`);await writeFile(filePath,Buffer.from(await download.arrayBuffer()));return {id:`asset-${job.id}`,projectId:job.projectId,sceneId:job.sceneId,kind:"video",filePath,provider:this.id,mimeType:"video/mp4",source:"generated",sourcePrompt:job.prompt};
 }
}
