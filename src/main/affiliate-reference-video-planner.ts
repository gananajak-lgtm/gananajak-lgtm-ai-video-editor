import type { AffiliateProduct } from "../shared/affiliate-factory";import type { AssetJob,ContentProject,GeneratedAsset } from "../shared/content-factory";
export type AffiliateVideoPlan={jobs:AssetJob[];fallbackImageAssets:GeneratedAsset[]};
const SHOTS=["hero product shot with natural camera movement","a hand naturally interacting with the product","close detail shot with realistic parallax and lighting","lifestyle use shot while preserving the exact product identity","clean closing product shot for call to action"];
export function buildAffiliateReferenceVideoPlan(product:AffiliateProduct,project:ContentProject,imageAssets:GeneratedAsset[]):AffiliateVideoPlan{
 const now=new Date().toISOString(),images=imageAssets.filter(a=>a.kind==="image");
 if(!images.length)return {jobs:[],fallbackImageAssets:[]};
 const jobs=project.scenes.map((scene,index)=>{const reference=images[index%images.length];return {id:`${project.id}-${scene.id}-affiliate-video-${index+1}`,projectId:project.id,sceneId:scene.id,kind:"video" as const,prompt:[`Create a vertical 9:16 product video from the supplied reference image of ${product.title}.`,SHOTS[index%SHOTS.length],scene.videoPrompt||scene.visualIntent,"Preserve the product shape, colors, branding, labels, proportions and visible physical details from the reference image. Do not invent features, accessories, text, logos, packaging claims, buttons or ports that are not visible. Motion must be physically plausible. The result must be moving video, not a still-image zoom or pan."].join(" "),status:"queued" as const,attempts:0,referenceAssetId:reference.id,referenceImagePath:reference.filePath,createdAt:now,updatedAt:now};});
 return {jobs,fallbackImageAssets:images};
}
