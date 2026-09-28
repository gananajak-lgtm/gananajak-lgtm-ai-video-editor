import { mkdir, writeFile } from "node:fs/promises";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import path from "node:path";
import type { AffiliateProduct } from "../shared/affiliate-factory";
import { readManagedProductPhoto } from "./affiliate-local-images";
import type { ContentProject, GeneratedAsset } from "../shared/content-factory";

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 20_000;

function isUnsafeAddress(address:string):boolean {
  if (address.includes(":")) {
    const value=address.toLowerCase().split("%")[0];
    if (value==="::1" || value==="::" || value.startsWith("fe80:") || value.startsWith("fc") || value.startsWith("fd") ||
        value.startsWith("ff") || value.startsWith("2001:db8:")) return true;
    if (value.startsWith("::ffff:")) return isUnsafeAddress(value.slice(7));
    return false;
  }
  const parts=address.split(".").map(Number);
  const [a,b]=parts;
  return a===0 || a===10 || a===127 || a>=224 || (a===169&&b===254) ||
    (a===172&&b>=16&&b<=31) || (a===192&&b===168) || (a===100&&b>=64&&b<=127) ||
    (a===192&&b===0) || (a===198&&(b===18||b===19));
}

async function validateSourceUrl(value:string, resolveDns:boolean):Promise<URL> {
  let url:URL;
  try { url=new URL(value); } catch { throw new Error("Product image URL is invalid."); }
  if (url.protocol!=="https:" || url.username || url.password || (url.port && url.port!=="443"))
    throw new Error("Product images must use public HTTPS URLs.");
  const host=url.hostname.toLowerCase().replace(/\.$/,"");
  if (!host || host==="localhost" || host.endsWith(".localhost") || host.endsWith(".local") ||
      host.endsWith(".internal") || host.endsWith(".test") || host.endsWith(".invalid"))
    throw new Error("Product image URL targets a private hostname.");
  if (isIP(host)) {
    if(isUnsafeAddress(host)) throw new Error("Product image URL targets a private IP address.");
  } else if (resolveDns) {
    const addresses=await lookup(host,{all:true});
    if(!addresses.length || addresses.some(entry=>isUnsafeAddress(entry.address)))
      throw new Error("Product image hostname resolves to a private address.");
  }
  return url;
}

async function downloadImage(sourceUrl:string, fetcher:typeof fetch):Promise<{bytes:Uint8Array;ext:string;mimeType:string}> {
  let url=sourceUrl;
  for(let redirect=0;redirect<=MAX_REDIRECTS;redirect++){
    await validateSourceUrl(url,fetcher===fetch);
    const response=await fetcher(url,{redirect:"manual",signal:AbortSignal.timeout(TIMEOUT_MS)});
    if(response.status>=300&&response.status<400){
      const location=response.headers.get("location");
      if(!location || redirect===MAX_REDIRECTS)throw new Error("Too many product image redirects.");
      url=new URL(location,url).toString();
      continue;
    }
    if(!response.ok)throw new Error(`Product image download failed (${response.status})`);
    const declared=Number(response.headers.get("content-length")??0);
    if(declared>MAX_IMAGE_BYTES)throw new Error("Product image exceeds the 12 MB limit.");
    const chunks:Uint8Array[]=[];let size=0;
    if(!response.body)throw new Error("Product image response is empty.");
    const reader=response.body.getReader();
    try {
      while(true){
        const {done,value}=await reader.read();
        if(done)break;
        size+=value.byteLength;
        if(size>MAX_IMAGE_BYTES)throw new Error("Product image exceeds the 12 MB limit.");
        chunks.push(value);
      }
    } finally { await reader.cancel().catch(()=>{}); }
    const bytes=new Uint8Array(size);
    let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    const png=bytes.length>=8 && [137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);
    const jpg=bytes.length>=3 && bytes[0]===255 && bytes[1]===216 && bytes[2]===255;
    const webp=bytes.length>=12 && String.fromCharCode(...bytes.slice(0,4))==="RIFF" && String.fromCharCode(...bytes.slice(8,12))==="WEBP";
    if(!png&&!jpg&&!webp)throw new Error("Product image data is not PNG, JPEG or WebP.");
    return {bytes,ext:png?"png":webp?"webp":"jpg",mimeType:png?"image/png":webp?"image/webp":"image/jpeg"};
  }
  throw new Error("Product image redirect limit exceeded.");
}

export async function stageAffiliateProductImages(product:AffiliateProduct,project:ContentProject,root:string,fetcher:typeof fetch=fetch,managedPhotoRoot?:string):Promise<ContentProject>{
  const candidates=[...(product.localImagePaths??[]).map(ref=>({ref,local:true})),...product.imageUrls.map(ref=>({ref,local:false}))];
  if(!candidates.length)return project;
  await mkdir(root,{recursive:true});const assets:GeneratedAsset[]=[];const jobs=[];
  const cache=new Map<string,Awaited<ReturnType<typeof downloadImage>>>();
  const rejected=new Map<string,string>();
  for(const scene of project.scenes){
    let selected:{sourceUrl:string;image:Awaited<ReturnType<typeof downloadImage>>}|null=null;
    // A broken product thumbnail should not prevent using another genuine image.
    for(let offset=0;offset<candidates.length;offset++){
      const candidate=candidates[((scene.order-1)+offset)%candidates.length];
      const sourceUrl=candidate.ref;
      if(!sourceUrl||rejected.has(sourceUrl))continue;
      try{
        let image=cache.get(sourceUrl);
        if(!image){
          image=candidate.local
            ? await readManagedProductPhoto(sourceUrl,managedPhotoRoot??"")
            : await downloadImage(sourceUrl,fetcher);
          cache.set(sourceUrl,image);
        }
        selected={sourceUrl,image};
        break;
      }catch(error){
        rejected.set(sourceUrl,error instanceof Error?error.message:String(error));
      }
    }
    if(!selected)throw new Error(`No safe, usable product image is available. ${Array.from(rejected.values()).join(" · ")}`);
    const {sourceUrl,image}=selected;
    const filePath=path.join(root,`product-scene-${scene.order}.${image.ext}`);
    await writeFile(filePath,image.bytes);
    const asset:GeneratedAsset={id:`product-image-${project.id}-${scene.order}`,projectId:project.id,sceneId:scene.id,kind:"image",filePath,provider:"affiliate-product",mimeType:image.mimeType,source:"imported",sourcePrompt:sourceUrl};assets.push(asset);
    const now=new Date().toISOString();jobs.push({id:`job-${asset.id}`,projectId:project.id,sceneId:scene.id,kind:"image" as const,prompt:`Product image from source: ${sourceUrl}`,status:"succeeded" as const,attempts:1,outputAssetId:asset.id,createdAt:now,updatedAt:now});
  }
  if(!assets.length)return project;
  return {...project,assetPlan:{projectId:project.id,jobs,assets},updatedAt:new Date().toISOString()};
}
