import type { TimelinePlan, TranscriptResult } from "../../shared/types";
import { buildSubtitleCues } from "../editing/subtitlePlanner";
import { probeDuration } from "./probe";

export async function buildAutomaticTimeline(
  images: string[],
  narration: string,
  transcript?: TranscriptResult | null
): Promise<TimelinePlan> {
  if (images.length === 0) {
    throw new Error("At least one image is required.");
  }

  const duration = await probeDuration(narration);
  const averageClipDuration = duration / images.length;

  const clips = images.map((imagePath, index) => {
    const start = index * averageClipDuration;
    const clipDuration =
      index === images.length - 1 ? duration - start : averageClipDuration;

    return {
      id: `clip-${index + 1}`,
      imagePath,
      start,
      duration: clipDuration,
      motion: "slow-zoom-in" as const
    };
  });

  return {
    duration,
    narration,
    width: 1920,
    height: 1080,
    fps: 30,
    clips,
    audioLayers: [],
    subtitles: transcript ? buildSubtitleCues(transcript) : [],
    transitionDuration: 0.35,
    quality: "standard"
  };
}
