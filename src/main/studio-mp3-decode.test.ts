import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import ffmpegPath from "ffmpeg-static";
import { checkMp3Decoding, isDecodableMp3 } from "./studio-mp3-decode";

test("cached MP3 validation decodes valid audio and rejects damaged assets", async t => {
  if (typeof ffmpegPath !== "string" || !ffmpegPath) {
    t.skip("FFmpeg executable unavailable");
    return;
  }
  const folder = await mkdtemp(path.join(os.tmpdir(), "studio-mp3-test-"));
  t.after(async () => { await rm(folder, { recursive: true, force: true }); });
  const valid = path.join(folder, "valid.mp3");
  const encoded = spawnSync(ffmpegPath, [
    "-hide_banner", "-nostdin", "-loglevel", "error",
    "-f", "lavfi", "-i", "sine=frequency=440:duration=0.5",
    "-codec:a", "libmp3lame", "-q:a", "4", valid
  ], { timeout: 15000, windowsHide: true });
  assert.equal(encoded.status, 0, String(encoded.stderr));
  assert.equal(await isDecodableMp3(valid), true);
  assert.deepEqual(await checkMp3Decoding(valid), { valid: true });
  assert.equal(await isDecodableMp3(path.join(folder, "missing.mp3")), false);
  const missingResult = await checkMp3Decoding(path.join(folder, "missing.mp3"));
  assert.equal(missingResult.valid, false);
  if (!missingResult.valid) assert.match(missingResult.reason, /FFmpeg exited|FFmpeg launch failed/);
  const invalid = path.join(folder, "invalid.mp3");
  await writeFile(invalid, Buffer.from("ID3\\x04\\x00\\x00\\x00\\x00\\x00\\x00not audio"));
  assert.equal(await isDecodableMp3(invalid), false);
  const truncated = path.join(folder, "truncated.mp3");
  const bytes = await readFile(valid);
  await writeFile(truncated, bytes.subarray(0, 10));
  assert.equal(await isDecodableMp3(truncated), false);
});
