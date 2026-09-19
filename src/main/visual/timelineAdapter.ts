import type {
  TimelineClip,
  TimelinePlan,
  TranscriptResult,
  VisualBrainPlan
} from "../../shared/types";
import { buildSubtitleCues } from "../editing/subtitlePlanner";
import { probeDuration } from "../video/probe";

export async function buildTimelineFromVisualPlan(
  narrationPath: string,
  plan: VisualBrainPlan,
  transcript: TranscriptResult
): Promise<TimelinePlan> {
  const totalDuration = await probeDuration(narrationPath);
  const shots = [...plan.shots]
    .filter((shot) => shot.start < totalDuration)
    .sort((a, b) => a.start - b.start);

  if (!shots.length) {
    throw new Error("Visual Brain plan contains no usable shots.");
  }

  const clips: TimelineClip[] = shots.map((shot, index) => {
    const next = shots[index + 1];
    const start = index === 0 ? 0 : shot.start;
    const end = next ? Math.min(next.start, totalDuration) : totalDuration;

    return {
      id: shot.id,
      imagePath: shot.imagePath,
      start,
      duration: Math.max(0.04, end - start),
      motion: shot.motion
    };
  });

  return {
    duration: totalDuration,
    narration: narrationPath,
    width: 1920,
    height: 1080,
    fps: 30,
    clips,
    audioLayers: [],
    subtitles: buildSubtitleCues(transcript),
    transitionDuration: 0.35,
    quality: "standard",
    subtitleStyle: {
      fontFamily: "",
      scale: 1,
      position: "bottom"
    },
    exportSubtitleSidecar: false
  };
}
