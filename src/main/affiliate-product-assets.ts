import { mkdir, writeFile } from "node:fs/promises";import path from "node:path";import type { AffiliateProduct } from "../shared/affiliate-factory";import type { ContentProject, GeneratedAsset } from "../shared/content-factory";

export async function stageAffiliateProductImages(product:AffiliateProduct,project:ContentProject,root:string,fetcher:typeof fetch=fetch):Promise<ContentProject>{
  if(!product.imageUrls.length)return project;
  await mkdir(root,{recursive:true});const assets:GeneratedAsset[]=[];const jobs=[];
  for(const scene of project.scenes){
    const sourceUrl=product.imageUrls[(scene.order-1)%product.imageUrls.length];if(!sourceUrl)continue;
    const response=await fetcher(sourceUrl);if(!response.ok)throw new Error(`Product image download failed (${response.status})`);
    const contentType=response.headers.get("content-type")??"";const ext=contentType.includes("png")?"png":contentType.includes("webp")?"webp":"jpg";const filePath=path.join(root,`product-scene-${scene.order}.${ext}`);
    await writeFile(filePath,Buffer.from(await response.arrayBuffer()));
    const asset:GeneratedAsset={id:`product-image-${project.id}-${scene.order}`,projectId:project.id,sceneId:scene.id,kind:"image",filePath,provider:"affiliate-product",mimeType:contentType||undefined,source:"imported",sourcePrompt:sourceUrl};assets.push(asset);
    const now=new Date().toISOString();jobs.push({id:`job-${asset.id}`,projectId:project.id,sceneId:scene.id,kind:"image" as const,prompt:`Verified product image: ${sourceUrl}`,status:"succeeded" as const,attempts:1,outputAssetId:asset.id,createdAt:now,updatedAt:now});
  }
  if(!assets.length)return project;
  return {...project,assetPlan:{projectId:project.id,jobs,assets},updatedAt:new Date().toISOString()};
}
