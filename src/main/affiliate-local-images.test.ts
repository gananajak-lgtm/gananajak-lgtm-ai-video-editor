import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp,readFile,rm,writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { identifyProductImage, importLocalProductPhotos, readManagedProductPhoto } from "./affiliate-local-images";
const png=new Uint8Array([137,80,78,71,13,10,26,10,1,2,3,4]);
test("manual selected photo is copied to app storage and can be staged",async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),"aff-photo-"));
 try{
   const source=path.join(root,"original.png"),safe=path.join(root,"managed");
   await writeFile(source,png);
   const files=await importLocalProductPhotos([source],safe);
   assert.equal(files.length,1);
   assert.ok(files[0].startsWith(safe+path.sep));
   const loaded=await readManagedProductPhoto(files[0],safe);
   assert.equal(loaded.ext,"png");
   assert.deepEqual(loaded.bytes,png);
   assert.deepEqual(new Uint8Array(await readFile(files[0])),png);
   await assert.rejects(()=>readManagedProductPhoto(source,safe),/outside managed/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test("manual photo importer rejects invalid image content",async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),"aff-photo-"));
 try{
   assert.throws(()=>identifyProductImage(new Uint8Array([1,2,3])),/PNG, JPEG or WebP/);
   const bad=path.join(root,"fake.png");
   await writeFile(bad,"not an image");
   await assert.rejects(()=>importLocalProductPhotos([bad],path.join(root,"managed")),/PNG, JPEG or WebP/);
 }finally{await rm(root,{recursive:true,force:true});}
});
