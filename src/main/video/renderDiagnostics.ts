import type {
  RenderDiagnostic,
  RenderDiagnostics,
  TimelinePlan
} from "../../shared/types";

function push(
  diagnostics: RenderDiagnostic[],
  id: string,
  level: RenderDiagnostic["level"],
  message: string
) {
  diagnostics.push({ id, level, message });
}

export function analyzeRenderPlan(plan: TimelinePlan): RenderDiagnostics {
  const diagnostics: RenderDiagnostic[] = [];
  const clipDuration = plan.clips.reduce(
    (sum, clip) => sum + Math.max(0, clip.duration),
    0
  );
  const durationGap = Math.abs(clipDuration - plan.duration);
  const megapixelsPerFrame = (plan.width * plan.height) / 1_000_000;
  const estimatedFrames = Math.max(
    0,
    Math.round(plan.duration * plan.fps)
  );

  if (!plan.clips.length) {
    push(diagnostics, "no-clips", "error", "Timeline has no visual clips.");
  }

  if (!Number.isFinite(plan.duration) || plan.duration <= 0) {
    push(
      diagnostics,
      "duration",
      "error",
      "Timeline duration must be greater than zero."
    );
  }

  if (
    !Number.isInteger(plan.width) ||
    !Number.isInteger(plan.height) ||
    plan.width < 240 ||
    plan.height < 240 ||
    plan.width % 2 !== 0 ||
    plan.height % 2 !== 0
  ) {
    push(
      diagnostics,
      "dimensions",
      "error",
      "Export dimensions must be even whole numbers of at least 240 pixels."
    );
  }

  if (![24, 25, 30, 60].includes(plan.fps)) {
    push(
      diagnostics,
      "fps",
      "error",
      "Frame rate must be 24, 25, 30, or 60 fps."
    );
  }

  const invalidClips = plan.clips.filter(
    (clip) =>
      !clip.imagePath ||
      !Number.isFinite(clip.duration) ||
      clip.duration <= 0
  );

  if (invalidClips.length) {
    push(
      diagnostics,
      "invalid-clips",
      "error",
      `${invalidClips.length} timeline clip${invalidClips.length === 1 ? "" : "s"} have invalid duration or media paths.`
    );
  }

  if (durationGap > 2) {
    push(
      diagnostics,
      "runtime-gap",
      "error",
      `Visual runtime differs from narration by ${durationGap.toFixed(1)} seconds.`
    );
  } else if (durationGap > 0.25) {
    push(
      diagnostics,
      "runtime-gap-warning",
      "warning",
      `Visual runtime differs from narration by ${durationGap.toFixed(1)} seconds.`
    );
  }

  const outOfRangeSubtitles = plan.subtitles.filter(
    (cue) =>
      cue.start < 0 ||
      cue.end <= cue.start ||
      cue.start > plan.duration ||
      cue.end > plan.duration + 0.25
  );

  if (outOfRangeSubtitles.length) {
    push(
      diagnostics,
      "subtitle-range",
      "warning",
      `${outOfRangeSubtitles.length} subtitle cue${outOfRangeSubtitles.length === 1 ? "" : "s"} fall outside the expected narration range.`
    );
  }

  const inactiveLayers = plan.audioLayers.filter(
    (layer) =>
      layer.duration <= 0 ||
      layer.start >= plan.duration ||
      layer.start + layer.duration <= 0
  );

  if (inactiveLayers.length) {
    push(
      diagnostics,
      "inactive-audio",
      "info",
      `${inactiveLayers.length} audio layer${inactiveLayers.length === 1 ? "" : "s"} will not contribute to the exported runtime.`
    );
  }

  if (plan.clips.length >= 300) {
    push(
      diagnostics,
      "many-clips",
      "warning",
      `This episode has ${plan.clips.length} shots. Rendering can take substantially longer and use more memory.`
    );
  }

  if (plan.audioLayers.length >= 80) {
    push(
      diagnostics,
      "many-audio-layers",
      "warning",
      `This episode mixes ${plan.audioLayers.length} extra audio layers. Consider consolidating long ambience or music beds if rendering becomes slow.`
    );
  }

  if (plan.width >= 3840 && plan.height >= 2160 && plan.fps >= 60) {
    push(
      diagnostics,
      "4k60",
      "warning",
      "4K at 60 fps is a heavy CPU render. A draft export is useful before the final high-quality pass."
    );
  } else if (
    plan.width >= 3840 &&
    plan.height >= 2160 &&
    plan.duration >= 1200
  ) {
    push(
      diagnostics,
      "long-4k",
      "warning",
      "This is a long 4K episode. Expect a significantly longer render than 1080p."
    );
  }

  if (plan.duration >= 1800) {
    push(
      diagnostics,
      "long-duration",
      "info",
      `Long-episode mode: ${Math.round(plan.duration / 60)} minutes, approximately ${estimatedFrames.toLocaleString()} frames.`
    );
  }

  if (!diagnostics.some((item) => item.level === "error")) {
    push(
      diagnostics,
      "ready",
      "info",
      "Timeline structure is ready for FFmpeg export."
    );
  }

  return {
    ready: !diagnostics.some((item) => item.level === "error"),
    clipCount: plan.clips.length,
    subtitleCount: plan.subtitles.length,
    audioLayerCount: plan.audioLayers.length,
    duration: plan.duration,
    estimatedFrames,
    megapixelsPerFrame,
    diagnostics
  };
}
