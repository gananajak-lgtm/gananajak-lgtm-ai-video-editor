import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { assertMyCutImageHeader } from "./mycut-image-header";

test("MyCut image preflight recognizes PNG and JPEG magic bytes", async t => {
 const dir=await mkdtemp(path.join(os.tmpdir(),"mycut-image-header-"));
 t.after(()=>rm(dir,{recursive:true,force:true}));
 const png=path.join(dir,"scene.png"),jpeg=path.join(dir,"scene.jpg");
 await writeFile(png,Buffer.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82]));
 await writeFile(jpeg,Buffer.from([255,216,255,224,0,16,74,70,73,70,0,0,0,0,0,0]));
 await assert.doesNotReject(assertMyCutImageHeader(png));
 await assert.doesNotReject(assertMyCutImageHeader(jpeg));
});
test("MyCut image preflight rejects empty, wrong-extension and disguised images",async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),"mycut-invalid-image-"));
 t.after(()=>rm(dir,{recursive:true,force:true}));
 const wrong=path.join(dir,"fake.png"),tiny=path.join(dir,"tiny.webp"),txt=path.join(dir,"text.txt");
 await writeFile(wrong,"ordinary text masquerading as PNG");
 await writeFile(tiny,Buffer.from([82,73,70,70]));
 await writeFile(txt,"ordinary text file");
 await assert.rejects(assertMyCutImageHeader(wrong),/Invalid MyCut image header/);
 await assert.rejects(assertMyCutImageHeader(tiny),/Invalid MyCut image header/);
 await assert.rejects(assertMyCutImageHeader(txt),/Unsupported MyCut image format/);
});
