import fs from "node:fs/promises";
import path from "node:path";
import type {
  FullEpisodeTestReport,
  RenderDiagnostic,
  TimelinePlan
} from "../../shared/types";
import { probeMediaInfo } from "./probe";

function push(
  diagnostics: RenderDiagnostic[],
  id: string,
  level: RenderDiagnostic["level"],
  message: string
) {
  diagnostics.push({ id, level, message });
}

function reportPathFor(outputPath: string) {
  const ext = path.extname(outputPath);
  const base = ext ? outputPath.slice(0, -ext.length) : outputPath;
  return `${base}.render-report.json`;
}

export async function verifyRenderedOutput(
  plan: TimelinePlan,
  outputPath: string
): Promise<FullEpisodeTestReport> {
  const info = await probeMediaInfo(outputPath);
  const video = info.streams.find((stream) => stream.codecType === "video");
  const audio = info.streams.find((stream) => stream.codecType === "audio");
  const diagnostics: RenderDiagnostic[] = [];

  if (!video) {
    push(diagnostics, "video-stream", "error", "Rendered file has no video stream.");
  }

  if (!audio) {
    push(diagnostics, "audio-stream", "error", "Rendered file has no audio stream.");
  }

  if (
    video?.width !== null &&
    video?.height !== null &&
    (video?.width !== plan.width || video?.height !== plan.height)
  ) {
    push(
      diagnostics,
      "resolution",
      "error",
      `Rendered resolution is ${video.width}×${video.height}, expected ${plan.width}×${plan.height}.`
    );
  }

  if (video?.fps !== null && Math.abs(video.fps - plan.fps) > 0.1) {
    push(
      diagnostics,
      "fps",
      "error",
      `Rendered frame rate is ${video.fps.toFixed(3)} fps, expected ${plan.fps} fps.`
    );
  }

  const durationDelta = Math.abs(info.duration - plan.duration);
  const durationTolerance = Math.max(0.5, 3 / Math.max(1, plan.fps));

  if (durationDelta > 1.5) {
    push(
      diagnostics,
      "duration",
      "error",
      `Rendered duration differs from the timeline by ${durationDelta.toFixed(3)} seconds.`
    );
  } else if (durationDelta > durationTolerance) {
    push(
      diagnostics,
      "duration-warning",
      "warning",
      `Rendered duration differs from the timeline by ${durationDelta.toFixed(3)} seconds.`
    );
  }

  const videoDuration = video?.duration ?? info.duration;
  const audioDuration = audio?.duration ?? info.duration;
  const avSyncDelta =
    videoDuration !== null && audioDuration !== null
      ? Math.abs(videoDuration - audioDuration)
      : null;

  if (avSyncDelta !== null && avSyncDelta > 1.5) {
    push(
      diagnostics,
      "av-sync",
      "error",
      `Audio/video stream durations differ by ${avSyncDelta.toFixed(3)} seconds.`
    );
  } else if (avSyncDelta !== null && avSyncDelta > 0.5) {
    push(
      diagnostics,
      "av-sync-warning",
      "warning",
      `Audio/video stream durations differ by ${avSyncDelta.toFixed(3)} seconds.`
    );
  }

  if (info.sizeBytes <= 0) {
    push(
      diagnostics,
      "file-size",
      "error",
      "Rendered output has an invalid file size."
    );
  }

  const expectedFrames = Math.round(plan.duration * plan.fps);
  const frameCount = video?.frameCount ?? null;

  if (frameCount !== null) {
    const frameDelta = Math.abs(frameCount - expectedFrames);
    if (frameDelta > Math.max(plan.fps, 10)) {
      push(
        diagnostics,
        "frame-count",
        "warning",
        `Rendered frame count differs from the timeline estimate by ${frameDelta.toLocaleString()} frames.`
      );
    }
  } else {
    push(
      diagnostics,
      "frame-count-unavailable",
      "info",
      "FFprobe could not report an exact decoded frame count for this output."
    );
  }

  if (!diagnostics.some((item) => item.level === "error")) {
    push(
      diagnostics,
      "verified",
      "info",
      "Rendered MP4 passed the structural post-render checks."
    );
  }

  const reportPath = reportPathFor(outputPath);
  const report: FullEpisodeTestReport = {
    id: `render-test-${Date.now()}`,
    createdAt: new Date().toISOString(),
    outputPath,
    reportPath,
    passed: !diagnostics.some((item) => item.level === "error"),
    expectedDuration: plan.duration,
    actualDuration: info.duration,
    durationDelta,
    fileSizeBytes: info.sizeBytes,
    width: video?.width ?? null,
    height: video?.height ?? null,
    fps: video?.fps ?? null,
    videoCodec: video?.codecName ?? null,
    audioCodec: audio?.codecName ?? null,
    videoDuration,
    audioDuration,
    avSyncDelta,
    frameCount,
    expectedFrames,
    diagnostics
  };

  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
  return report;
}
