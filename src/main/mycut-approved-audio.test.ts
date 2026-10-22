import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, writeFile, readFile, rm, access } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { assertApprovedMyCutMp3Hashes } from "./mycut-approved-audio";

test("approved MP3 remains valid until bytes change, including same-size replacements", async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mycut-audio-verify-"));
  t.after(async () => { await rm(dir, { recursive: true, force: true }); });
  const file = path.join(dir, "voice.mp3");
  await writeFile(file, Buffer.from("ID3FIRST"));
  const hash = createHash("sha256").update(await readFile(file)).digest("hex");
  await assertApprovedMyCutMp3Hashes([file], [hash]);
  // Changed bytes, same path, same size. Validation must reject before any write.
  await writeFile(file, Buffer.from("ID3OTHER"));
  const destination = path.join(dir, "export.mycut");
  await assert.rejects(assertApprovedMyCutMp3Hashes([file], [hash]), /changed before project serialization/);
  await assert.rejects(access(destination));
});

test("approved MP3 verification rejects malformed hashes and missing media", async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mycut-audio-missing-"));
  t.after(async () => { await rm(dir, { recursive: true, force: true }); });
  const file = path.join(dir, "missing.mp3");
  await assert.rejects(assertApprovedMyCutMp3Hashes([file], ["bad"]), /Invalid MyCut/);
  await assert.rejects(assertApprovedMyCutMp3Hashes([file], ["0".repeat(64)]), /ENOENT/);
  await assert.rejects(assertApprovedMyCutMp3Hashes([], []), /Invalid MyCut/);
});

test("approved MP3 hash order is binding", async t => {
 const dir=await mkdtemp(path.join(os.tmpdir(),"mycut-order-"));
 t.after(()=>rm(dir,{recursive:true,force:true}));
 const one=path.join(dir,"one.mp3"), two=path.join(dir,"two.mp3");
 await writeFile(one,"ID3first"); await writeFile(two,"ID3other");
 const hashes=await Promise.all([one,two].map(async file=>createHash("sha256").update(await readFile(file)).digest("hex")));
 await assertApprovedMyCutMp3Hashes([one,two],hashes);
 await assert.rejects(assertApprovedMyCutMp3Hashes([two,one],hashes),/changed/);
});

test("second approved clip changing is rejected even if the first is unchanged", async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mycut-second-clip-"));
  t.after(async () => { await rm(dir, { recursive: true, force: true }); });
  const first = path.join(dir, "first.mp3");
  const second = path.join(dir, "second.mp3");
  await writeFile(first, "ID3clip01");
  await writeFile(second, "ID3clip02");
  const hashes = await Promise.all([first, second].map(async file =>
    createHash("sha256").update(await readFile(file)).digest("hex")
  ));
  await assertApprovedMyCutMp3Hashes([first, second], hashes);
  await writeFile(second, "ID3clip03");
  await assert.rejects(assertApprovedMyCutMp3Hashes([first, second], hashes), /changed/);
  await assert.rejects(assertApprovedMyCutMp3Hashes([first, second], [hashes[0]]), /Invalid MyCut/);
});
