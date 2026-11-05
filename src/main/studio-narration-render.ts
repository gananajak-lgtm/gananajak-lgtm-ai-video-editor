import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { copyFile, mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import ffprobePath from "ffprobe-static";
import { resolveBundledFfmpegPath } from "./studio-mp3-decode";
import { planNarrationSegments, type SegmentSource } from "./studio-narration-segments";

/** Verify the physically encoded MP3, not only the planned duration. */
async function inspectCombinedDuration(file: string): Promise<number> {
  if (!ffprobePath?.path) throw new Error("FFprobe unavailable");
  const executable = resolveBundledFfmpegPath(ffprobePath.path);
  return new Promise<number>((resolve, reject) => {
    const child = spawn(executable, [
      "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file
    ], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    let stderr = "";
    let finished = false;
    const finish = (error?: Error, seconds?: number) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      if (error) reject(error); else resolve(seconds!);
    };
    const timeout = setTimeout(() => {
      child.kill();
      finish(new Error("Combined MP3 duration probe timed out"));
    }, 30000);
    child.stdout.on("data", chunk => { output = (output + String(chunk)).slice(-1000); });
    child.stderr.on("data", chunk => { stderr = (stderr + String(chunk)).slice(-1000); });
    child.on("error", error => finish(error));
    child.on("close", code => {
      if (code !== 0) return finish(new Error("Could not inspect combined MP3: " + stderr));
      const seconds = Number(output.trim());
      if (!Number.isFinite(seconds) || seconds <= 0) return finish(new Error("Invalid combined MP3 duration"));
      finish(undefined, seconds);
    });
  });
}

async function verifyCombinedDuration(file: string, expected: number): Promise<void> {
  const actual = await inspectCombinedDuration(file);
  if (actual > 180 || Math.abs(actual - expected) > 2.5) {
    throw new Error(
      "Combined MP3 duration does not match plan: " +
      actual.toFixed(3) + "s actual, " + expected.toFixed(3) + "s planned. " +
      "Original MP3s are safe; no MyCut project was written."
    );
  }
}

export type CombinedNarration = { audio: string; start: number; duration: number; lineIds: string[] };
const active = new Map<string, Promise<CombinedNarration[]>>();

/** Keep originals, merge only verified voice files. This never calls a paid provider. */
export async function buildCombinedNarration(
  lines: SegmentSource[], episodeAudioFolder: string, gapSeconds = 0.8
): Promise<CombinedNarration[]> {
  if (!lines.length) return [];
  if (typeof ffmpegPath !== "string" || !ffmpegPath) throw new Error("FFmpeg unavailable");
  const executable = resolveBundledFfmpegPath(ffmpegPath);
  const plan = planNarrationSegments(lines, gapSeconds, 178, 80);
  const destination = path.join(episodeAudioFolder, "segments");
  await mkdir(destination, { recursive: true });
  const results: CombinedNarration[] = [];
  for (const segment of plan.segments) {
    const signatures = await Promise.all(segment.sources.map(async line => {
      const info = await stat(line.audio);
      if (!info.isFile() || !info.size) throw new Error("Missing source audio: " + line.lineId);
      return [line.lineId, line.audio, info.size, info.mtimeMs, line.duration];
    }));
    const key = createHash("sha256").update(JSON.stringify([signatures, gapSeconds, segment.leadingPause, 1])).digest("hex");
    const target = path.join(destination, "narration-" + key + ".mp3");
    let work = active.get(target);
    if (!work) {
      work = (async () => {
        try {
          const existing = await stat(target);
          if (existing.isFile() && existing.size > 0) {
            await verifyCombinedDuration(target, segment.duration);
            return [];
          }
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
        const token = randomUUID();
        const temporary = path.join(destination, "." + token + ".mp3");
        const filterFile = path.join(destination, "." + token + ".txt");
        const samples: string[] = [];
        const filters: string[] = [];
        for (let i = 0; i < segment.sources.length; i++) {
          if (i !== 0 || segment.leadingPause > 0) {
            const gapIndex = samples.length;
            const tag = "gap" + gapIndex;
            filters.push("anullsrc=r=44100:cl=stereo,atrim=duration=" + gapSeconds + ",asetpts=PTS-STARTPTS[" + tag + "]");
            samples.push("[" + tag + "]");
          }
          const tag = "voice" + i;
          filters.push("[" + i + ":a:0]aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo,asetpts=PTS-STARTPTS[" + tag + "]");
          samples.push("[" + tag + "]");
        }
        filters.push(samples.join("") + "concat=n=" + samples.length + ":v=0:a=1[out]");
        await writeFile(filterFile, filters.join(";\n"), { flag: "wx" });
        try {
          const args = ["-hide_banner", "-nostdin", "-y", "-v", "error"];
          for (const voice of segment.sources) args.push("-i", voice.audio);
          args.push("-filter_complex_script", filterFile, "-map", "[out]", "-ar", "44100", "-ac", "2", "-codec:a", "libmp3lame", "-b:a", "128k", temporary);
          await new Promise<void>((resolve, reject) => {
            const child = spawn(executable, args, { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
            let errors = "";
            const timeout = setTimeout(() => { child.kill(); reject(new Error("Narration merge timed out")); }, 180000);
            child.stderr.on("data", data => { errors = (errors + String(data)).slice(-3000); });
            child.on("error", error => { clearTimeout(timeout); reject(error); });
            child.on("close", code => { clearTimeout(timeout); code === 0 ? resolve() : reject(new Error("Narration merge failed: " + errors)); });
          });
          const merged = await stat(temporary);
          if (!merged.isFile() || !merged.size) throw new Error("Empty combined narration");
          await verifyCombinedDuration(temporary, segment.duration);
          await copyFile(temporary, target, constants.COPYFILE_EXCL).catch(async error => {
            if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
          });
        } finally {
          await rm(filterFile, { force: true }).catch(() => {});
          await rm(temporary, { force: true }).catch(() => {});
        }
        return [];
      })().finally(() => active.delete(target));
      active.set(target, work);
    }
    await work;
    await verifyCombinedDuration(target, segment.duration);
    results.push({ audio: target, start: segment.start, duration: segment.duration, lineIds: segment.sources.map(line => line.lineId) });
  }
  return results;
}
