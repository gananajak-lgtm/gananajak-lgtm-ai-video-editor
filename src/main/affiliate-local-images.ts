import { randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";

const LIMIT=12*1024*1024;
const MAX_FILES=12;
export function identifyProductImage(bytes:Uint8Array):"png"|"jpg"|"webp" {
 const png=bytes.length>=8 && [137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);
 const jpg=bytes.length>=3 && bytes[0]===255 && bytes[1]===216 && bytes[2]===255;
 const webp=bytes.length>=12 && String.fromCharCode(...bytes.slice(0,4))==="RIFF" && String.fromCharCode(...bytes.slice(8,12))==="WEBP";
 if(!png&&!jpg&&!webp)throw new Error("Product photo must be a PNG, JPEG or WebP image.");
 return png?"png":webp?"webp":"jpg";
}
export async function importLocalProductPhotos(selected:string[],storageRoot:string):Promise<string[]> {
 if(selected.length>MAX_FILES)throw new Error("Select up to 12 product photos.");
 await mkdir(storageRoot,{recursive:true});
 const saved:string[]=[];
 for(const userPath of selected){
   const info=await stat(userPath);
   if(!info.isFile() || info.size>LIMIT)throw new Error("Each product photo must be a file smaller than 12 MB.");
   const bytes=await readFile(userPath);
   const ext=identifyProductImage(bytes);
   const destination=path.join(storageRoot,`${randomUUID()}.${ext}`);
   await copyFile(userPath,destination);
   saved.push(destination);
 }
 return saved;
}
/** Never read arbitrary paths provided through IPC or modified queue files. */
export async function readManagedProductPhoto(filePath:string,storageRoot:string):Promise<{bytes:Uint8Array;ext:string;mimeType:string}>{
 const [root,actual]=await Promise.all([realpath(storageRoot),realpath(filePath)]);
 if(!actual.startsWith(root+path.sep))throw new Error("Product photo is outside managed app storage.");
 const info=await stat(actual);
 if(!info.isFile()||info.size>LIMIT)throw new Error("Product photo exceeds the 12 MB limit.");
 const bytes=await readFile(actual);
 const ext=identifyProductImage(bytes);
 return {bytes,ext,mimeType:ext==="png"?"image/png":ext==="webp"?"image/webp":"image/jpeg"};
}
