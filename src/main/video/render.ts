import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import type { TimelinePlan } from "../../shared/types";

function fixed(value: number) {
  return Math.max(0.04, value).toFixed(3);
}

function createFilter(plan: TimelinePlan) {
  const filters = plan.clips.map((clip, index) => {
    const duration = fixed(clip.duration);

    return [
      `[${index}:v]`,
      `scale=${plan.width}:${plan.height}:force_original_aspect_ratio=increase,`,
      `crop=${plan.width}:${plan.height},`,
      "setsar=1,",
      "zoompan=",
      "z='min(zoom+0.0006,1.08)':",
      "x='iw/2-(iw/zoom/2)':",
      "y='ih/2-(ih/zoom/2)':",
      `d=1:s=${plan.width}x${plan.height}:fps=${plan.fps},`,
      `trim=duration=${duration},setpts=PTS-STARTPTS[v${index}]`
    ].join("");
  });

  const labels = plan.clips.map((_, index) => `[v${index}]`).join("");
  const concat =
    plan.clips.length === 1
      ? ""
      : `${labels}concat=n=${plan.clips.length}:v=1:a=0[vout]`;

  return {
    filter: [...filters, concat].filter(Boolean).join(";"),
    videoMap: plan.clips.length === 1 ? "[v0]" : "[vout]"
  };
}

export function renderTimeline(
  plan: TimelinePlan,
  outputPath: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) {
      reject(new Error("Bundled FFmpeg binary is unavailable."));
      return;
    }

    if (plan.clips.length === 0) {
      reject(new Error("Timeline has no clips."));
      return;
    }

    const args: string[] = ["-y"];

    for (const clip of plan.clips) {
      args.push(
        "-loop",
        "1",
        "-framerate",
        String(plan.fps),
        "-t",
        fixed(clip.duration),
        "-i",
        clip.imagePath
      );
    }

    const narrationInput = plan.clips.length;
    args.push("-i", plan.narration);

    const { filter, videoMap } = createFilter(plan);
    args.push(
      "-filter_complex",
      filter,
      "-map",
      videoMap,
      "-map",
      `${narrationInput}:a:0`,
      "-r",
      String(plan.fps),
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "20",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-shortest",
      "-movflags",
      "+faststart",
      outputPath
    );

    const process = spawn(ffmpegPath, args);
    let stderr = "";

    process.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 16000) {
        stderr = stderr.slice(-16000);
      }
    });

    process.on("error", reject);

    process.on("close", (code) => {
      if (code === 0) {
        resolve(outputPath);
      } else {
        reject(new Error(stderr.trim() || `FFmpeg exited with code ${code}.`));
      }
    });
  });
}
