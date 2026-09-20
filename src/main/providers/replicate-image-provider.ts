import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AssetJob, GeneratedAsset } from "../shared/content-factory";
import type { AssetGenerationContext, AssetProvider } from "./content-asset-provider";
import { getReplicateApiToken } from "./settings";

type Prediction = { id:string; status:string; output?:unknown; error?:string; urls?:{get?:string} };

async function download(url:string, filePath:string) {
  const response=await fetch(url);
  if(!response.ok) throw new Error(`Replicate output download failed: ${response.status}`);
  await writeFile(filePath, Buffer.from(await response.arrayBuffer()));
}

export class ReplicateImageProvider implements AssetProvider {
  readonly id="replicate-image";
  constructor(private readonly model=process.env.REPLICATE_IMAGE_MODEL?.trim() || "black-forest-labs/flux-schnell") {}
  supports(kind: AssetJob["kind"]) { return kind === "image"; }

  async generate(job:AssetJob, context:AssetGenerationContext):Promise<GeneratedAsset> {
    const token=await getReplicateApiToken();
    if(!token) throw new Error("Replicate API token is not configured.");
    const [owner,name]=this.model.split("/");
    if(!owner || !name) throw new Error("REPLICATE_IMAGE_MODEL must be owner/model.");
    const endpoint=`https://api.replicate.com/v1/models/${owner}/${name}/predictions`;
    let response=await fetch(endpoint,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json",Prefer:"wait"},body:JSON.stringify({input:{prompt:job.prompt,aspect_ratio:"9:16",output_format:"png"}})});
    if(!response.ok) throw new Error(`Replicate prediction failed: ${response.status} ${await response.text()}`);
    let prediction=await response.json() as Prediction;
    while(["starting","processing"].includes(prediction.status)) {
      await new Promise(resolve=>setTimeout(resolve,1500));
      response=await fetch(prediction.urls?.get || `https://api.replicate.com/v1/predictions/${prediction.id}`,{headers:{Authorization:`Bearer ${token}`}});
      if(!response.ok) throw new Error(`Replicate polling failed: ${response.status}`);
      prediction=await response.json() as Prediction;
    }
    if(prediction.status!=="succeeded") throw new Error(prediction.error || `Replicate prediction ended with ${prediction.status}`);
    const output=Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
    if(typeof output!=="string") throw new Error("Replicate returned no downloadable image URL.");
    await mkdir(context.workDir,{recursive:true});
    const filePath=path.join(context.workDir,`${job.id}.png`);
    await download(output,filePath);
    return {id:`asset-${job.id}`,projectId:job.projectId,sceneId:job.sceneId,kind:"image",filePath,provider:this.id,mimeType:"image/png"};
  }
}
