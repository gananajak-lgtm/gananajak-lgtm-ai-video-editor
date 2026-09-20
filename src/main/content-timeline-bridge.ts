import type { ContentProject, GeneratedAsset } from "../shared/content-factory";
import type { AudioLayer, VisualBrainPlan } from "../shared/types";

export type ContentTimelineBridge = {
  visualPlan: VisualBrainPlan;
  voicePaths: string[];
  sfxLayers: AudioLayer[];
  missingSceneIds: string[];
  readyForNarrationAssembly: boolean;
};

function sceneStarts(project: ContentProject): Map<string, number> {
  const starts = new Map<string, number>();
  let cursor = 0;
  for (const scene of project.scenes) {
    starts.set(scene.id, cursor);
    cursor += scene.estimatedDuration;
  }
  return starts;
}

export function bridgeGeneratedAssets(project: ContentProject): ContentTimelineBridge {
  const assets = project.assetPlan?.assets ?? [];
  const starts = sceneStarts(project);
  const descriptors: VisualBrainPlan["descriptors"] = [];
  const matches: VisualBrainPlan["matches"] = [];
  const shots: VisualBrainPlan["shots"] = [];
  const voicePaths: string[] = [];
  const sfxLayers: AudioLayer[] = [];
  const missingSceneIds: string[] = [];

  for (const scene of project.scenes) {
    const sceneAssets = assets.filter((asset) => asset.sceneId === scene.id);
    const image = sceneAssets.find((asset) => asset.kind === "image");
    const voice = sceneAssets.find((asset) => asset.kind === "voice");
    const start = starts.get(scene.id) ?? 0;

    if (!image) {
      missingSceneIds.push(scene.id);
    } else {
      const imageId = `${scene.id}-generated-image`;
      descriptors.push({
        id: imageId,
        filePath: image.filePath,
        summary: scene.visualIntent,
        characters: [],
        actions: [],
        setting: [],
        mood: [],
        shotType: "unknown"
      });
      matches.push({
        sceneId: scene.id,
        imageId,
        score: 1,
        reason: "Generated specifically for this content scene."
      });
      shots.push({
        id: `${scene.id}-generated-shot`,
        sceneId: scene.id,
        imageId,
        imagePath: image.filePath,
        start,
        duration: scene.estimatedDuration,
        motion: scene.order % 2 === 0 ? "slow-zoom-out" : "slow-zoom-in",
        reason: "Content Factory generated asset."
      });
    }

    if (voice) voicePaths.push(voice.filePath);

    for (const asset of sceneAssets.filter((item) => item.kind === "sfx")) {
      sfxLayers.push({
        id: `${asset.id}-layer`,
        filePath: asset.filePath,
        kind: "sfx",
        start,
        duration: asset.duration ?? Math.min(3, scene.estimatedDuration),
        volume: 0.55,
        loop: false,
        fadeIn: 0.05,
        fadeOut: 0.15,
        origin: "auto-sfx",
        label: "AI Content Factory SFX"
      });
    }
  }

  return {
    visualPlan: { descriptors, matches, shots },
    voicePaths,
    sfxLayers,
    missingSceneIds,
    readyForNarrationAssembly:
      missingSceneIds.length === 0 && voicePaths.length === project.scenes.length
  };
}
