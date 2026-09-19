import { spawn } from "node:child_process";
import ffprobeStatic from "ffprobe-static";

export type ProbedStream = {
  codecType: string | null;
  codecName: string | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  duration: number | null;
  frameCount: number | null;
};

export type ProbedMediaInfo = {
  duration: number;
  sizeBytes: number;
  streams: ProbedStream[];
};

function parseNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseFps(value: unknown) {
  if (typeof value !== "string" || !value || value === "0/0") return null;

  const [numerator, denominator] = value.split("/").map(Number);
  if (
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    denominator === 0
  ) {
    return null;
  }

  return numerator / denominator;
}

function parseFrameCount(stream: Record<string, unknown>) {
  const readFrames = parseNumber(stream.nb_read_frames);
  if (readFrames !== null && readFrames >= 0) return Math.round(readFrames);

  const frames = parseNumber(stream.nb_frames);
  if (frames !== null && frames >= 0) return Math.round(frames);

  return null;
}

function runProbe(filePath: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const process = spawn(ffprobeStatic.path, [...args, filePath]);
    let stdout = "";
    let stderr = "";

    process.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    process.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    process.on("error", reject);

    process.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || "Unable to inspect media."));
        return;
      }

      resolve(stdout);
    });
  });
}

export async function probeDuration(filePath: string): Promise<number> {
  const stdout = await runProbe(filePath, [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1"
  ]);

  const duration = Number.parseFloat(stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("Narration duration is invalid.");
  }

  return duration;
}

export async function probeMediaInfo(
  filePath: string
): Promise<ProbedMediaInfo> {
  const stdout = await runProbe(filePath, [
    "-v",
    "error",
    "-count_frames",
    "-show_entries",
    "format=duration,size:stream=codec_type,codec_name,width,height,avg_frame_rate,duration,nb_frames,nb_read_frames",
    "-of",
    "json"
  ]);

  const parsed = JSON.parse(stdout) as {
    format?: Record<string, unknown>;
    streams?: Array<Record<string, unknown>>;
  };

  const duration = parseNumber(parsed.format?.duration);
  if (duration === null || duration <= 0) {
    throw new Error("Rendered media duration is invalid.");
  }

  const sizeBytes = parseNumber(parsed.format?.size) ?? 0;
  const streams = (parsed.streams ?? []).map((stream) => ({
    codecType:
      typeof stream.codec_type === "string" ? stream.codec_type : null,
    codecName:
      typeof stream.codec_name === "string" ? stream.codec_name : null,
    width: parseNumber(stream.width),
    height: parseNumber(stream.height),
    fps: parseFps(stream.avg_frame_rate),
    duration: parseNumber(stream.duration),
    frameCount: parseFrameCount(stream)
  }));

  return {
    duration,
    sizeBytes,
    streams
  };
}
