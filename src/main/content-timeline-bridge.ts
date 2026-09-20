import type { ContentProject, GeneratedAsset } from "../shared/content-factory";
import type { AudioLayer, SubtitleCue, TimelinePlan, VisualBrainPlan } from "../shared/types";

export type NarrationSegment = { sceneId: string; filePath: string; start: number; duration: number; text: string };

export type ContentTimelineBridge = {
  visualPlan: VisualBrainPlan;
  narrationSegments: NarrationSegment[];
  sfxLayers: AudioLayer[];
  subtitles: SubtitleCue[];
  duration: number;
  missingSceneIds: string[];
  readyForNarrationAssembly: boolean;
};

function voiceFor(assets: GeneratedAsset[], sceneId: string) {
  return assets.find((asset) => asset.sceneId === sceneId && asset.kind === "voice");
}

export function bridgeGeneratedAssets(project: ContentProject): ContentTimelineBridge {
  const assets = project.assetPlan?.assets ?? [];
  const descriptors: VisualBrainPlan["descriptors"] = [];
  const matches: VisualBrainPlan["matches"] = [];
  const shots: VisualBrainPlan["shots"] = [];
  const narrationSegments: NarrationSegment[] = [];
  const sfxLayers: AudioLayer[] = [];
  const subtitles: SubtitleCue[] = [];
  const missingSceneIds: string[] = [];
  let cursor = 0;

  for (const scene of project.scenes) {
    const sceneAssets = assets.filter((asset) => asset.sceneId === scene.id);
    const image = sceneAssets.find((asset) => asset.kind === "image");
    const video = sceneAssets.find((asset) => asset.kind === "video");
    const voice = voiceFor(assets, scene.id);
    const duration = voice?.duration ?? scene.estimatedDuration;
    const start = cursor;

    if (!image && !video) missingSceneIds.push(scene.id);
    else {
      // Keep an image fallback for the existing visual plan. The final timeline prefers imported Meta video.
      const visual = image ?? video!;
      const imageId = `${scene.id}-generated-image`;
      descriptors.push({ id:imageId, filePath:visual.filePath, summary:scene.visualIntent, characters:[], actions:[], setting:[], mood:[], shotType:"unknown" });
      matches.push({ sceneId:scene.id, imageId, score:1, reason:"Generated specifically for this content scene." });
      shots.push({ id:`${scene.id}-generated-shot`, sceneId:scene.id, imageId, imagePath:visual.filePath, start, duration, motion:scene.order % 2 === 0 ? "slow-zoom-out" : "slow-zoom-in", reason:"Content Factory generated asset synced to narration." });
    }

    if (voice) narrationSegments.push({ sceneId:scene.id, filePath:voice.filePath, start, duration, text:scene.narration });
    subtitles.push({ id:`subtitle-${scene.id}`, start, end:start + duration, text:scene.narration });

    for (const asset of sceneAssets.filter((item) => item.kind === "sfx")) {
      sfxLayers.push({ id:`${asset.id}-layer`, filePath:asset.filePath, kind:"sfx", start, duration:asset.duration ?? Math.min(3,duration), volume:0.55, loop:false, fadeIn:0.05, fadeOut:0.15, origin:"auto-sfx", label:"AI Content Factory SFX" });
    }
    cursor += duration;
  }

  return {
    visualPlan:{ descriptors, matches, shots },
    narrationSegments,
    sfxLayers,
    subtitles,
    duration:cursor,
    missingSceneIds,
    readyForNarrationAssembly: missingSceneIds.length === 0 && narrationSegments.length === project.scenes.length
  };
}

export function buildGeneratedTimeline(project: ContentProject, narrationPath: string): TimelinePlan {
  const bridge = bridgeGeneratedAssets(project);
  if (!bridge.readyForNarrationAssembly) throw new Error("Generated content is missing required visual or voice assets.");
  return {
    duration: bridge.duration,
    narration: narrationPath,
    width: 1080,
    height: 1920,
    fps: 30,
    clips: bridge.visualPlan.shots.map((shot) => {
      const video = project.assetPlan?.assets.find((asset) => asset.sceneId === shot.sceneId && asset.kind === "video");
      const image = project.assetPlan?.assets.find((asset) => asset.sceneId === shot.sceneId && asset.kind === "image");
      return { id:shot.id, imagePath:image?.filePath ?? shot.imagePath, videoPath:video?.filePath, videoDuration:video?.duration, start:shot.start, duration:shot.duration, motion:shot.motion };
    }),
    audioLayers: bridge.sfxLayers,
    subtitles: bridge.subtitles,
    transitionDuration: 0.25,
    quality: "high",
    exportSubtitleSidecar: true,
    narrationOffset: 0
  };
}
