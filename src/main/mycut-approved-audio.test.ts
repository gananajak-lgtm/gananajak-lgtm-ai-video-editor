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
