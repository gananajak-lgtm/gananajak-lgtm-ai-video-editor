import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import type {
  AudioLayer,
  RenderProgress,
  RenderQuality,
  ShotMotion,
  SubtitleCue,
  TimelinePlan
} from "../../shared/types";

function fixed(value: number) {
  return Math.max(0.04, value).toFixed(3);
}

function qualitySettings(quality: RenderQuality | undefined) {
  switch (quality ?? "standard") {
    case "draft":
      return { preset: "veryfast", crf: "25", audioBitrate: "160k" };
    case "high":
      return { preset: "slow", crf: "17", audioBitrate: "256k" };
    case "standard":
    default:
      return { preset: "medium", crf: "20", audioBitrate: "192k" };
  }
}

function validateTimelinePlan(plan: TimelinePlan) {
  if (plan.clips.length === 0) {
    throw new Error("Timeline has no clips.");
  }

  if (!Number.isFinite(plan.duration) || plan.duration <= 0) {
    throw new Error("Timeline duration is invalid.");
  }

  if (
    !Number.isInteger(plan.width) ||
    !Number.isInteger(plan.height) ||
    plan.width < 240 ||
    plan.height < 240 ||
    plan.width % 2 !== 0 ||
    plan.height % 2 !== 0
  ) {
    throw new Error(
      "Export dimensions must be even whole numbers of at least 240 pixels."
    );
  }

  if (![24, 25, 30, 60].includes(plan.fps)) {
    throw new Error("Unsupported export frame rate.");
  }

  for (const clip of plan.clips) {
    if (!clip.imagePath || !Number.isFinite(clip.duration) || clip.duration <= 0) {
      throw new Error(`Invalid timeline clip: ${clip.id}`);
    }
  }
}

function transitionDurations(plan: TimelinePlan) {
  return plan.clips.slice(0, -1).map((clip, index) => {
    const next = plan.clips[index + 1];
    return Math.max(
      0,
      Math.min(
        plan.transitionDuration,
        clip.duration * 0.25,
        next.duration * 0.25
      )
    );
  });
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

function sanitizeAssStyleValue(value: string) {
  return value.replace(/[,']/g, " ").trim();
}

function subtitleSidecarPath(outputPath: string) {
  const ext = path.extname(outputPath);
  const base = ext ? outputPath.slice(0, -ext.length) : outputPath;
  return `${base}.srt`;
}

function escapeFilterPath(filePath: string) {
  return filePath
    .replace(/\\/g, "/")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/,/g, "\\,")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]");
}

function createVideoFilter(
  plan: TimelinePlan,
  subtitlePath: string | null
) {
  const transitions = transitionDurations(plan);

  const filters = plan.clips.map((clip, index) => {
    const extra = transitions[index] ?? 0;
    const renderDuration = clip.duration + extra;

    return [
      `[${index}:v]`,
      `scale=${plan.width}:${plan.height}:force_original_aspect_ratio=increase,`,
      `crop=${plan.width}:${plan.height},`,
      "setsar=1,",
      motionFilter(
        clip.motion,
        renderDuration,
        plan.width,
        plan.height,
        plan.fps
      ),
      ",",
      `trim=duration=${fixed(renderDuration)},setpts=PTS-STARTPTS,fps=${plan.fps},settb=AVTB,format=yuv420p[v${index}]`
    ].join("");
  });

  let videoMap = "[v0]";

  if (plan.clips.length > 1) {
    let current = "[v0]";
    let offset = plan.clips[0].duration;

    for (let index = 1; index < plan.clips.length; index += 1) {
      const transition = transitions[index - 1];
      const output = `[vx${index}]`;

      if (transition > 0) {
        filters.push(
          `${current}[v${index}]xfade=transition=fade:duration=${fixed(
            transition
          )}:offset=${fixed(offset)}${output}`
        );
      } else {
        filters.push(
          `${current}[v${index}]concat=n=2:v=1:a=0${output}`
        );
      }

      current = output;
      offset += plan.clips[index].duration;
    }

    videoMap = current;
  }

  if (subtitlePath) {
    const escaped = escapeFilterPath(subtitlePath);
    const subtitleScale = Math.max(
      0.7,
      Math.min(1.8, plan.subtitleStyle?.scale ?? 1)
    );
    const subtitleFontSize = Math.max(
      18,
      Math.round(plan.height * 0.028 * subtitleScale)
    );
    const subtitleOutline = Math.max(
      2,
      Math.round(plan.height / 720)
    );
    const subtitleMargin = Math.max(
      42,
      Math.round(plan.height * 0.04)
    );
    const alignment =
      plan.subtitleStyle?.position === "middle" ? 5 : 2;
    const requestedFont = sanitizeAssStyleValue(
      plan.subtitleStyle?.fontFamily ?? ""
    );
    const style = [
      requestedFont ? `FontName=${requestedFont}` : "",
      `FontSize=${subtitleFontSize}`,
      `Outline=${subtitleOutline}`,
      "Shadow=0",
      `Alignment=${alignment}`,
      `MarginV=${alignment === 2 ? subtitleMargin : 0}`
    ]
      .filter(Boolean)
      .join(",");

    filters.push(
      `${videoMap}subtitles=filename='${escaped}':force_style='${style}'[vsub]`
    );
    videoMap = "[vsub]";
  }

  return {
    filters,
    videoMap,
    transitions
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
  const narrationOffset = Math.max(0, plan.narrationOffset ?? 0);
  const filters: string[] = [
    `[${narrationInput}:a]atrim=start=${narrationOffset.toFixed(
      3
    )}:duration=${fixed(
      plan.duration
    )},asetpts=PTS-STARTPTS,volume=1[narr]`
  ];

  const labels = ["[narr]"];

  activeLayers.forEach((layer, index) => {
    const inputIndex = narrationInput + 1 + index;
    const duration = effectiveLayerDuration(layer, plan.duration);
    const delayMs = Math.max(0, Math.round(layer.start * 1000));
    const fadeIn = Math.min(Math.max(0, layer.fadeIn), duration / 2);
    const fadeOut = Math.min(Math.max(0, layer.fadeOut), duration / 2);
    const fadeOutStart = Math.max(0, duration - fadeOut);

    const sourceOffset = Math.max(0, layer.sourceOffset ?? 0);
    const chain = [
      `[${inputIndex}:a]`,
      `atrim=start=${sourceOffset.toFixed(3)}:duration=${fixed(duration)},`,
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
      `${labels.join("")}amix=inputs=${labels.length}:duration=first:normalize=0,alimiter=limit=0.95,atrim=duration=${fixed(
        plan.duration
      )}[aout]`
    );
  }

  return {
    filters,
    audioMap: "[aout]"
  };
}

function formatSrtTime(seconds: number) {
  const milliseconds = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const secs = Math.floor((milliseconds % 60_000) / 1000);
  const millis = milliseconds % 1000;

  return [
    String(hours).padStart(2, "0"),
    String(minutes).padStart(2, "0"),
    String(secs).padStart(2, "0")
  ].join(":") + `,${String(millis).padStart(3, "0")}`;
}

function subtitleFileContents(cues: SubtitleCue[]) {
  return cues
    .filter((cue) => cue.text.trim() && cue.end > cue.start)
    .map((cue, index) => {
      const text = cue.text.replace(/\r/g, "").trim();
      return [
        String(index + 1),
        `${formatSrtTime(cue.start)} --> ${formatSrtTime(cue.end)}`,
        text,
        ""
      ].join("\n");
    })
    .join("\n");
}

async function writeSubtitleFile(
  directory: string,
  cues: SubtitleCue[]
) {
  if (!cues.length) return null;

  const filePath = path.join(directory, "captions.srt");
  await fs.writeFile(filePath, subtitleFileContents(cues), "utf8");
  return filePath;
}

function parseProgressSeconds(line: string) {
  const match = line.match(/^out_time_ms=(\d+)$/);
  if (!match) return null;
  return Number(match[1]) / 1_000_000;
}

function runFfmpeg(
  args: string[],
  outputPath: string,
  duration: number,
  onProgress?: (progress: RenderProgress) => void
) {
  return new Promise<string>((resolve, reject) => {
    if (!ffmpegPath) {
      reject(new Error("Bundled FFmpeg binary is unavailable."));
      return;
    }

    const process = spawn(ffmpegPath, args);
    let stderr = "";
    let progressBuffer = "";
    let lastPercent = -1;

    onProgress?.({
      progress: 0,
      elapsed: 0,
      duration
    });

    process.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      progressBuffer += text;

      if (stderr.length > 24000) {
        stderr = stderr.slice(-24000);
      }

      const lines = progressBuffer.split(/\r?\n/);
      progressBuffer = lines.pop() ?? "";

      for (const line of lines) {
        const elapsed = parseProgressSeconds(line.trim());
        if (elapsed === null) continue;

        const fraction = Math.max(
          0,
          Math.min(1, elapsed / Math.max(duration, 0.001))
        );
        const percent = Math.floor(fraction * 100);

        if (percent !== lastPercent) {
          lastPercent = percent;
          onProgress?.({
            progress: fraction,
            elapsed: Math.min(elapsed, duration),
            duration
          });
        }
      }
    });

    process.on("error", reject);

    process.on("close", (code) => {
      if (code === 0) {
        onProgress?.({
          progress: 1,
          elapsed: duration,
          duration
        });
        resolve(outputPath);
      } else {
        reject(new Error(stderr.trim() || `FFmpeg exited with code ${code}.`));
      }
    });
  });
}

export async function renderTimeline(
  plan: TimelinePlan,
  outputPath: string,
  onProgress?: (progress: RenderProgress) => void
): Promise<string> {
  if (!ffmpegPath) {
    throw new Error("Bundled FFmpeg binary is unavailable.");
  }

  validateTimelinePlan(plan);

  const workDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), "ai-video-editor-render-")
  );

  try {
    const subtitlePath = await writeSubtitleFile(
      workDirectory,
      plan.subtitles ?? []
    );
    const args: string[] = ["-y"];
    const transitions = transitionDurations(plan);

    for (const [index, clip] of plan.clips.entries()) {
      const renderDuration = clip.duration + (transitions[index] ?? 0);
      args.push(
        "-loop",
        "1",
        "-framerate",
        String(plan.fps),
        "-t",
        fixed(renderDuration),
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

    const video = createVideoFilter(plan, subtitlePath);
    const audio = createAudioFilter(plan, narrationInput, activeLayers);
    const filterScriptPath = path.join(workDirectory, "filter.ffgraph");

    await fs.writeFile(
      filterScriptPath,
      [...video.filters, ...audio.filters].join(";"),
      "utf8"
    );

    const quality = qualitySettings(plan.quality);

    args.push(
      "-filter_complex_script",
      filterScriptPath,
      "-map",
      video.videoMap,
      "-map",
      audio.audioMap,
      "-r",
      String(plan.fps),
      "-c:v",
      "libx264",
      "-preset",
      quality.preset,
      "-crf",
      quality.crf,
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      quality.audioBitrate,
      "-t",
      fixed(plan.duration),
      "-movflags",
      "+faststart",
      "-progress",
      "pipe:2",
      "-nostats",
      outputPath
    );

    const renderedPath = await runFfmpeg(
      args,
      outputPath,
      plan.duration,
      onProgress
    );

    if (plan.exportSubtitleSidecar && (plan.subtitles?.length ?? 0) > 0) {
      await fs.writeFile(
        subtitleSidecarPath(outputPath),
        subtitleFileContents(plan.subtitles),
        "utf8"
      );
    }

    return renderedPath;
  } finally {
    await fs
      .rm(workDirectory, { recursive: true, force: true })
      .catch(() => undefined);
  }
}
