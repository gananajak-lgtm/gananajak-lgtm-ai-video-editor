import type { SceneBlock, TranscriptResult } from "../../shared/types";

const MIN_SCENE_SECONDS = 3.5;
const TARGET_SCENE_SECONDS = 7;
const MAX_SCENE_SECONDS = 13;
const HARD_PAUSE_SECONDS = 1.35;

function recommendedShotCount(duration: number) {
  if (duration <= TARGET_SCENE_SECONDS) return 1;
  return Math.max(1, Math.floor(duration / MIN_SCENE_SECONDS));
}

export function groupTranscriptIntoScenes(
  transcript: TranscriptResult
): SceneBlock[] {
  const segments = transcript.segments.filter(
    (segment) => segment.end > segment.start && segment.text.trim()
  );

  if (segments.length === 0) return [];

  const scenes: SceneBlock[] = [];
  let active = [segments[0]];

  const flush = () => {
    if (active.length === 0) return;

    const start = active[0].start;
    const end = active[active.length - 1].end;
    const duration = Math.max(0.04, end - start);

    scenes.push({
      id: `scene-${scenes.length + 1}`,
      start,
      end,
      duration,
      text: active.map((segment) => segment.text.trim()).join(" "),
      segmentIds: active.map((segment) => segment.id),
      recommendedShotCount: recommendedShotCount(duration),
      minShotDuration: MIN_SCENE_SECONDS
    });

    active = [];
  };

  for (let index = 1; index < segments.length; index += 1) {
    const next = segments[index];
    const previous = active[active.length - 1];
    const activeStart = active[0].start;
    const projectedDuration = next.end - activeStart;
    const pause = Math.max(0, next.start - previous.end);

    const activeDuration = previous.end - activeStart;
    const canCloseOnPause =
      pause >= HARD_PAUSE_SECONDS && activeDuration >= MIN_SCENE_SECONDS;
    const tooLong = projectedDuration > MAX_SCENE_SECONDS;

    if (canCloseOnPause || tooLong) {
      flush();
    }

    active.push(next);
  }

  flush();

  return scenes;
}
