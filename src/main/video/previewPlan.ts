import type {
  AudioLayer,
  SubtitleCue,
  TimelineClip,
  TimelinePlan
} from "../../shared/types";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function even(value: number) {
  const rounded = Math.max(2, Math.round(value));
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

function previewDimensions(width: number, height: number) {
  const maxSide = 960;
  const largest = Math.max(width, height);

  if (largest <= maxSide) {
    return { width: even(width), height: even(height) };
  }

  const scale = maxSide / largest;
  return {
    width: even(width * scale),
    height: even(height * scale)
  };
}

function sliceClips(
  clips: TimelineClip[],
  start: number,
  end: number
): TimelineClip[] {
  const sliced: TimelineClip[] = [];

  for (const clip of clips) {
    const clipStart = clip.start;
    const clipEnd = clip.start + clip.duration;
    const overlapStart = Math.max(start, clipStart);
    const overlapEnd = Math.min(end, clipEnd);

    if (overlapEnd <= overlapStart) continue;

    sliced.push({
      ...clip,
      id: `preview-${clip.id}`,
      start: overlapStart - start,
      duration: overlapEnd - overlapStart
    });
  }

  let cursor = 0;
  return sliced.map((clip) => {
    const next = { ...clip, start: cursor };
    cursor += next.duration;
    return next;
  });
}

function sliceSubtitles(
  cues: SubtitleCue[],
  start: number,
  end: number
): SubtitleCue[] {
  return cues
    .filter((cue) => cue.end > start && cue.start < end)
    .map((cue) => ({
      ...cue,
      id: `preview-${cue.id}`,
      start: Math.max(0, cue.start - start),
      end: Math.min(end, cue.end) - start
    }))
    .filter((cue) => cue.end > cue.start);
}

function sliceAudioLayer(
  layer: AudioLayer,
  start: number,
  end: number
): AudioLayer | null {
  const layerStart = layer.start;
  const layerEnd = layer.start + layer.duration;
  const overlapStart = Math.max(start, layerStart);
  const overlapEnd = Math.min(end, layerEnd);

  if (overlapEnd <= overlapStart) return null;

  return {
    ...layer,
    id: `preview-${layer.id}`,
    start: overlapStart - start,
    duration: overlapEnd - overlapStart,
    sourceOffset:
      (layer.sourceOffset ?? 0) + Math.max(0, overlapStart - layerStart)
  };
}

export function createPreviewTimeline(
  plan: TimelinePlan,
  requestedStart: number,
  requestedDuration: number
): TimelinePlan {
  const start = clamp(
    Number.isFinite(requestedStart) ? requestedStart : 0,
    0,
    Math.max(0, plan.duration - 0.5)
  );
  const duration = clamp(
    Number.isFinite(requestedDuration) ? requestedDuration : 20,
    1,
    Math.max(1, plan.duration - start)
  );
  const end = Math.min(plan.duration, start + duration);
  const actualDuration = end - start;
  const clips = sliceClips(plan.clips, start, end);

  if (!clips.length) {
    throw new Error("The selected preview range has no visual clips.");
  }

  const dimensions = previewDimensions(plan.width, plan.height);
  const audioLayers = plan.audioLayers
    .map((layer) => sliceAudioLayer(layer, start, end))
    .filter((layer): layer is AudioLayer => Boolean(layer));

  return {
    ...plan,
    duration: actualDuration,
    width: dimensions.width,
    height: dimensions.height,
    fps: Math.min(plan.fps, 30),
    clips,
    audioLayers,
    subtitles: sliceSubtitles(plan.subtitles, start, end),
    quality: "draft",
    narrationOffset: (plan.narrationOffset ?? 0) + start
  };
}
