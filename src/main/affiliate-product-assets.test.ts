import test from "node:test";import assert from "node:assert/strict";import { mkdtemp,readFile,rm } from "node:fs/promises";import os from "node:os";import path from "node:path";import { stageAffiliateProductImages } from "./affiliate-product-assets";import { buildLocalTestProject } from "./content-scene-planner";
test("stages verified product images across affiliate scenes",async()=>{const root=await mkdtemp(path.join(os.tmpdir(),"affiliate-assets-"));try{const project=buildLocalTestProject({topic:"สินค้า",format:"short",language:"th",targetDurationSeconds:20});const bytes=new Uint8Array([137,80,78,71,13,10,26,10,1,2,3,4]);const fetcher=async()=>new Response(bytes,{status:200,headers:{"content-type":"image/png"}});const staged=await stageAffiliateProductImages({id:"p",platform:"tiktok-shop",sourceUrl:"https://example.com",title:"สินค้า",imageUrls:["https://cdn.example.com/p.png"],importedAt:new Date().toISOString()},project,root,fetcher as typeof fetch);assert.equal(staged.assetPlan?.assets.length,project.scenes.length);assert.ok(staged.assetPlan?.assets.every(a=>a.provider==="affiliate-product"&&a.source==="imported"));assert.deepEqual(new Uint8Array(await readFile(staged.assetPlan!.assets[0].filePath)),bytes);}finally{await rm(root,{recursive:true,force:true});}});

test("rejects internal, non-HTTPS and malformed product image sources",async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),"affiliate-assets-"));
 try {
  const project=buildLocalTestProject({topic:"สินค้า",format:"short",language:"th",targetDurationSeconds:20});
  const fetcher=async()=>new Response(new Uint8Array([137,80,78,71,13,10,26,10]),{headers:{"content-type":"image/png"}});
  for(const sourceUrl of ["http://cdn.example.com/p.png","https://localhost/image","https://127.0.0.1/image","https://user:pass@cdn.example.com/image"]) {
   await assert.rejects(()=>stageAffiliateProductImages({id:"p",platform:"shopee",sourceUrl:"https://shop.example/p",title:"test",imageUrls:[sourceUrl],importedAt:new Date().toISOString()},project,root,fetcher as typeof fetch),/HTTPS|private/i);
  }
 } finally {await rm(root,{recursive:true,force:true});}
});

test("rejects non-image content and enforces declared size limit",async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),"affiliate-assets-"));
 try {
  const project=buildLocalTestProject({topic:"สินค้า",format:"short",language:"th",targetDurationSeconds:20});
  const product={id:"p",platform:"shopee" as const,sourceUrl:"https://shop.example/p",title:"test",imageUrls:["https://cdn.example.com/p.png"],importedAt:new Date().toISOString()};
  const wrong=async()=>new Response(new Uint8Array([1,2,3,4]),{headers:{"content-type":"image/png"}});
  await assert.rejects(()=>stageAffiliateProductImages(product,project,root,wrong as typeof fetch),/not PNG/);
  const huge=async()=>new Response(new Uint8Array([137,80,78,71,13,10,26,10]),{headers:{"content-length":"13000000"}});
  await assert.rejects(()=>stageAffiliateProductImages(product,project,root,huge as typeof fetch),/12 MB/);
 } finally {await rm(root,{recursive:true,force:true});}
});

test("uses another genuine product thumbnail when the first image fails",async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),"affiliate-assets-"));
 try{
  const project=buildLocalTestProject({topic:"สินค้า",format:"short",language:"th",targetDurationSeconds:20});
  const bytes=new Uint8Array([137,80,78,71,13,10,26,10,1,2,3,4]);
  let brokenCalls=0;
  const fetcher=async(url:string)=>{
   if(url.endsWith("/broken.png")){brokenCalls++;return new Response("missing",{status:404});}
   return new Response(bytes,{status:200,headers:{"content-type":"image/png"}});
  };
  const product={id:"p",platform:"shopee" as const,sourceUrl:"https://shop.example/p",title:"test",imageUrls:["https://cdn.example.com/broken.png","https://cdn.example.com/good.png"],importedAt:new Date().toISOString()};
  const result=await stageAffiliateProductImages(product,project,root,fetcher as typeof fetch);
  assert.equal(result.assetPlan?.assets.length,project.scenes.length);
  assert.ok(result.assetPlan?.assets.every(asset=>asset.sourcePrompt==="https://cdn.example.com/good.png"));
  assert.equal(brokenCalls,1);
 }finally{await rm(root,{recursive:true,force:true});}
});

test("stages selected local product photos without network access",async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),"affiliate-local-product-"));
 try{
  const managed=path.join(root,"photos"),work=path.join(root,"work");
  await import("node:fs/promises").then(fs=>fs.mkdir(managed,{recursive:true}));
  const photo=path.join(managed,"selected.png");
  const bytes=new Uint8Array([137,80,78,71,13,10,26,10,1,2,3,4]);
  await import("node:fs/promises").then(fs=>fs.writeFile(photo,bytes));
  const project=buildLocalTestProject({topic:"รองเท้าจริง",format:"short",language:"th",targetDurationSeconds:20});
  const product={id:"p",platform:"shopee" as const,sourceUrl:"https://shopee.co.th/product/1/2",title:"รองเท้า",imageUrls:[],localImagePaths:[photo],importedAt:new Date().toISOString()};
  const noNetwork=async()=>{throw new Error("Unexpected network request");};
  const result=await stageAffiliateProductImages(product,project,work,noNetwork as typeof fetch,managed);
  assert.equal(result.assetPlan?.assets.length,project.scenes.length);
  assert.ok(result.assetPlan?.assets.every(asset=>asset.filePath.endsWith(".png")&&asset.source==="imported"));
 }finally{await rm(root,{recursive:true,force:true});}
});
