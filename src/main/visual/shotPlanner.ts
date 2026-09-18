import type {
  ImageDescriptor,
  PlannedShot,
  SceneBlock,
  SceneImageMatch,
  ShotMotion
} from "../../shared/types";
import { topMatchesForScene } from "./sceneMatcher";

function chooseMotion(index: number, count: number): ShotMotion {
  if (count === 1) return "slow-zoom-in";

  const sequence: ShotMotion[] = [
    "slow-zoom-in",
    "hold",
    "pan-right",
    "slow-zoom-out",
    "pan-left"
  ];

  return sequence[index % sequence.length];
}

function maximumShots(scene: SceneBlock) {
  const byDuration = Math.max(
    1,
    Math.floor(scene.duration / Math.max(scene.minShotDuration, 0.5))
  );
  return Math.max(1, Math.min(scene.recommendedShotCount, byDuration, 3));
}

function descriptorMap(images: ImageDescriptor[]) {
  return new Map(images.map((image) => [image.id, image]));
}

export function planShots(
  scenes: SceneBlock[],
  matches: SceneImageMatch[],
  images: ImageDescriptor[]
): PlannedShot[] {
  const byId = descriptorMap(images);
  const planned: PlannedShot[] = [];
  let lastImageId: string | null = null;

  for (const scene of scenes) {
    const ranked = topMatchesForScene(matches, scene.id, 8);
    if (!ranked.length) continue;

    const desired = maximumShots(scene);
    const selected: SceneImageMatch[] = [];

    for (const match of ranked) {
      if (selected.some((item) => item.imageId === match.imageId)) continue;

      if (
        selected.length === 0 &&
        match.imageId === lastImageId &&
        ranked.some((candidate) => candidate.imageId !== lastImageId)
      ) {
        continue;
      }

      selected.push(match);
      if (selected.length >= desired) break;
    }

    if (!selected.length) selected.push(ranked[0]);

    const shotDuration = scene.duration / selected.length;
    let cursor = scene.start;

    selected.forEach((match, index) => {
      const descriptor = byId.get(match.imageId);
      if (!descriptor) return;

      const isLast = index === selected.length - 1;
      const duration = isLast ? scene.end - cursor : shotDuration;

      planned.push({
        id: `shot-${planned.length + 1}`,
        sceneId: scene.id,
        imageId: descriptor.id,
        imagePath: descriptor.filePath,
        start: cursor,
        duration: Math.max(0.04, duration),
        motion: chooseMotion(index, selected.length),
        reason: `${match.reason} | ${descriptor.summary}`
      });

      cursor += duration;
      lastImageId = descriptor.id;
    });
  }

  return planned.sort((a, b) => a.start - b.start);
}
