export type ContentAspectRatio = "9:16" | "16:9" | "1:1" | "4:5";

export type ContentAssetPreference = "image" | "video" | "mixed";
export type ContentAssetType = "image" | "video";

export type ContentFactoryStatus =
  | "draft"
  | "script-ready"
  | "scene-planned"
  | "assets-ready"
  | "timeline-ready"
  | "rendered";

export type ContentBrief = {
  topic: string;
  title: string;
  language: string;
  targetDurationSeconds: number;
  aspectRatio: ContentAspectRatio;
  assetPreference: ContentAssetPreference;
  tone: string[];
  audience: string | null;
  visualStyle: string | null;
};

export type ContentScript = {
  title: string;
  hook: string;
  narration: string;
  language: string;
  sourceNotes: string[];
};

export type ContentScene = {
  id: string;
  order: number;
  narration: string;
  estimatedDurationSeconds: number;
  visualIntent: string;
  assetType: ContentAssetType;
  promptSeed: string;
  continuityNotes: string[];
  sfxHints: string[];
};

export type ContentScenePlan = {
  targetDurationSeconds: number;
  estimatedDurationSeconds: number;
  wordsPerMinute: number;
  scenes: ContentScene[];
};

export type CreateContentProjectInput = {
  topic: string;
  title?: string;
  language?: string;
  targetDurationSeconds?: number;
  aspectRatio?: ContentAspectRatio;
  assetPreference?: ContentAssetPreference;
  tone?: string[];
  audience?: string | null;
  visualStyle?: string | null;
};

export type ContentFactoryProject = {
  schemaVersion: 1;
  id: string;
  createdAt: string;
  updatedAt: string;
  status: ContentFactoryStatus;
  brief: ContentBrief;
  script: ContentScript | null;
  scenePlan: ContentScenePlan | null;
};

export type ScenePlannerInput = {
  script: ContentScript;
  targetDurationSeconds: number;
  aspectRatio: ContentAspectRatio;
  assetPreference: ContentAssetPreference;
  wordsPerMinute?: number;
  preferredSceneSeconds?: number;
  minSceneSeconds?: number;
  maxSceneSeconds?: number;
  visualStyle?: string | null;
};
