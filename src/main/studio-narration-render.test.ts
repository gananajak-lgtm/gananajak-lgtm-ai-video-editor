import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import { resolveBundledFfmpegPath, checkMp3Decoding } from "./studio-mp3-decode";
import { buildCombinedNarration } from "./studio-narration-render";

async function makeTone(file: string, hz: number): Promise<void> {
  if (!ffmpegPath) throw new Error("FFmpeg unavailable");
  const executable = resolveBundledFfmpegPath(ffmpegPath);
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(executable, ["-hide_banner", "-nostdin", "-v", "error", "-f", "lavfi",
      "-i", "sine=frequency=" + hz + ":duration=0.7", "-c:a", "libmp3lame",
      "-q:a", "4", file], { stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
    let err = "";
    proc.stderr.on("data", data => { err += String(data); });
    proc.on("error", reject);
    proc.on("close", code => code === 0 ? resolve() : reject(new Error(err)));
  });
}
test("merge two real MP3 files with 0.8s silence; preserve originals and reuse immutable output", async () => {
  const folder = await mkdtemp(path.join(tmpdir(), "combined-narration-"));
  try {
    const a = path.join(folder, "a.mp3");
    const b = path.join(folder, "b.mp3");
    await makeTone(a, 330);
    await makeTone(b, 440);
    const prior = [await readFile(a), await readFile(b)];
    const sources = [{lineId:"a",audio:a,duration:0.7},{lineId:"b",audio:b,duration:0.7}];
    const result = await buildCombinedNarration(sources,folder);
    assert.equal(result.length,1);
    assert.deepEqual(result[0].lineIds,["a","b"]);
    assert.ok(result[0].duration<180);
    assert.equal((await checkMp3Decoding(result[0].audio)).valid,true);
    assert.deepEqual(await readFile(a),prior[0]);
    assert.deepEqual(await readFile(b),prior[1]);
    const before = await stat(result[0].audio);
    const reused = await buildCombinedNarration(sources,folder);
    const after = await stat(reused[0].audio);
    assert.equal(reused[0].audio,result[0].audio);
    assert.equal(after.mtimeMs,before.mtimeMs);
  } finally {
    await rm(folder,{recursive:true,force:true});
  }
});
