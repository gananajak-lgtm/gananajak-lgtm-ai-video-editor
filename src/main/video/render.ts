import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import type { AudioLayer, ShotMotion, TimelinePlan } from "../../shared/types";

function fixed(value: number) {
  return Math.max(0.04, value).toFixed(3);
}

function motionFilter(
  motion: ShotMotion,
  duration: number,
  width: number,
  height: number,
  fps: number
) {
  const frames = Math.max(1, Math.round(duration * fps));
  const common = `d=1:s=${width}x${height}:fps=${fps}`;

  switch (motion) {
    case "hold":
      return `zoompan=z='1.0':x='0':y='0':${common}`;
    case "slow-zoom-out":
      return [
        "zoompan=",
        "z='max(1.0,1.08-on*0.0006)':",
        "x='iw/2-(iw/zoom/2)':",
        "y='ih/2-(ih/zoom/2)':",
        common
      ].join("");
    case "pan-left":
      return [
        "zoompan=",
        "z='1.08':",
        `x='(iw-iw/zoom)*(1-min(on/${frames},1))':`,
        "y='ih/2-(ih/zoom/2)':",
        common
      ].join("");
    case "pan-right":
      return [
        "zoompan=",
        "z='1.08':",
        `x='(iw-iw/zoom)*min(on/${frames},1)':`,
        "y='ih/2-(ih/zoom/2)':",
        common
      ].join("");
    case "slow-zoom-in":
    default:
      return [
        "zoompan=",
        "z='min(zoom+0.0006,1.08)':",
        "x='iw/2-(iw/zoom/2)':",
        "y='ih/2-(ih/zoom/2)':",
        common
      ].join("");
  }
}

function createVideoFilter(plan: TimelinePlan) {
  const filters = plan.clips.map((clip, index) => {
    const duration = fixed(clip.duration);

    return [
      `[${index}:v]`,
      `scale=${plan.width}:${plan.height}:force_original_aspect_ratio=increase,`,
      `crop=${plan.width}:${plan.height},`,
      "setsar=1,",
      motionFilter(
        clip.motion,
        clip.duration,
        plan.width,
        plan.height,
        plan.fps
      ),
      ",",
      `trim=duration=${duration},setpts=PTS-STARTPTS[v${index}]`
    ].join("");
  });

  const labels = plan.clips.map((_, index) => `[v${index}]`).join("");
  const concat =
    plan.clips.length === 1
      ? ""
      : `${labels}concat=n=${plan.clips.length}:v=1:a=0[vout]`;

  return {
    filters: [...filters, concat].filter(Boolean),
    videoMap: plan.clips.length === 1 ? "[v0]" : "[vout]"
  };
}

function effectiveLayerDuration(layer: AudioLayer, planDuration: number) {
  const available = Math.max(0, planDuration - Math.max(0, layer.start));
  return Math.min(Math.max(0, layer.duration), available);
}

function createAudioFilter(
  plan: TimelinePlan,
  narrationInput: number,
  activeLayers: AudioLayer[]
) {
  const filters: string[] = [
    `[${narrationInput}:a]atrim=duration=${fixed(plan.duration)},asetpts=PTS-STARTPTS,volume=1[narr]`
  ];

  const labels = ["[narr]"];

  activeLayers.forEach((layer, index) => {
    const inputIndex = narrationInput + 1 + index;
    const duration = effectiveLayerDuration(layer, plan.duration);
    const delayMs = Math.max(0, Math.round(layer.start * 1000));
    const fadeIn = Math.min(Math.max(0, layer.fadeIn), duration / 2);
    const fadeOut = Math.min(Math.max(0, layer.fadeOut), duration / 2);
    const fadeOutStart = Math.max(0, duration - fadeOut);

    const chain = [
      `[${inputIndex}:a]`,
      `atrim=duration=${fixed(duration)},`,
      "asetpts=PTS-STARTPTS,",
      `volume=${Math.max(0, layer.volume).toFixed(3)},`,
      fadeIn > 0 ? `afade=t=in:st=0:d=${fixed(fadeIn)},` : "",
      fadeOut > 0
        ? `afade=t=out:st=${fixed(fadeOutStart)}:d=${fixed(fadeOut)},`
        : "",
      `adelay=${delayMs}:all=1[audio${index}]`
    ].join("");

    filters.push(chain);
    labels.push(`[audio${index}]`);
  });

  if (activeLayers.length === 0) {
    filters.push("[narr]anull[aout]");
  } else {
    filters.push(
      `${labels.join("")}amix=inputs=${labels.length}:duration=first:normalize=0,alimiter=limit=0.95,atrim=duration=${fixed(plan.duration)}[aout]`
    );
  }

  return {
    filters,
    audioMap: "[aout]"
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

    const activeLayers = (plan.audioLayers ?? []).filter(
      (layer) =>
        layer.start < plan.duration &&
        effectiveLayerDuration(layer, plan.duration) > 0
    );

    for (const layer of activeLayers) {
      if (layer.loop) {
        args.push("-stream_loop", "-1");
      }
      args.push("-i", layer.filePath);
    }

    const video = createVideoFilter(plan);
    const audio = createAudioFilter(plan, narrationInput, activeLayers);
    const filter = [...video.filters, ...audio.filters].join(";");

    args.push(
      "-filter_complex",
      filter,
      "-map",
      video.videoMap,
      "-map",
      audio.audioMap,
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
