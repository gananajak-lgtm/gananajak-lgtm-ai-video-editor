import type { ContentProject } from "../shared/content-factory";
import type { NarrationSegment } from "./content-timeline-bridge";

export type NarrationAssemblyPlan = {
  projectId: string;
  outputPath: string;
  segments: NarrationSegment[];
  duration: number;
};

function escapeConcatPath(filePath: string): string {
  return filePath.replace(/'/g, "'\\''");
}

export function buildNarrationAssemblyPlan(
  project: ContentProject,
  segments: NarrationSegment[],
  outputPath: string
): NarrationAssemblyPlan {
  if (segments.length !== project.scenes.length) {
    throw new Error("Narration assembly requires one voice asset per scene.");
  }
  const ordered = [...segments].sort((a, b) => a.start - b.start);
  const expectedSceneIds = new Set(project.scenes.map((scene) => scene.id));
  const segmentSceneIds = new Set(ordered.map((segment) => segment.sceneId));
  if (segmentSceneIds.size !== ordered.length || ordered.some((segment) => !expectedSceneIds.has(segment.sceneId))) {
    throw new Error("Narration assembly requires exactly one matching voice asset per scene.");
  }
  return {
    projectId: project.id,
    outputPath,
    segments: ordered,
    duration: ordered.reduce((sum, segment) => sum + segment.duration, 0)
  };
}

export function buildFfmpegConcatManifest(plan: NarrationAssemblyPlan): string {
  return plan.segments
    .map((segment) => `file '${escapeConcatPath(segment.filePath)}'`)
    .join("\n") + "\n";
}

export function buildNarrationConcatArgs(manifestPath: string, outputPath: string): string[] {
  return [
    "-hide_banner",
    "-y",
    "-f", "concat",
    "-safe", "0",
    "-i", manifestPath,
    "-vn",
    "-c:a", "aac",
    "-b:a", "192k",
    outputPath
  ];
}
