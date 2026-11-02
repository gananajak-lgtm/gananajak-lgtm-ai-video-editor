import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { persistGeneratedMp3Exclusively } from "./studio-voice-safe-write";

test("a paid MP3 cannot overwrite another take, even with the same target filename", async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "voice-no-overwrite-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const output = path.join(dir, "line-1.mp3");
  const incoming = path.join(dir, ".new-voice.mp3");
  const oldBytes = Buffer.from("ID3 original paid voice");
  const newBytes = Buffer.from("ID3 new paid voice");
  await writeFile(output, oldBytes);
  await writeFile(incoming, newBytes);
  await assert.rejects(persistGeneratedMp3Exclusively(incoming, output), /EEXIST/);
  assert.deepEqual(await readFile(output), oldBytes);
  const distinct = path.join(dir, "line-1-unique.mp3");
  await persistGeneratedMp3Exclusively(incoming, distinct);
  assert.deepEqual(await readFile(distinct), newBytes);
  assert.deepEqual(await readFile(output), oldBytes);
});
