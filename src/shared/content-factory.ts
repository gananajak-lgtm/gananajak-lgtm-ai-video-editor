export type ContentFormat = "short" | "episode";
export type ContentLanguage = "th" | "en";

export type ContentBrief = {
  topic: string;
  format: ContentFormat;
  language: ContentLanguage;
  targetDurationSeconds: number;
  tone?: string;
  audience?: string;
};

export type ContentScene = {
  id: string;
  order: number;
  narration: string;
  visualIntent: string;
  imagePrompt: string;
  videoPrompt?: string;
  sfxHints: string[];
  estimatedDuration: number;
};

export type AssetKind = "image" | "video" | "voice" | "sfx";
export type AssetSource = "generated" | "meta-manual" | "imported";
export type AssetJobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export type GeneratedAsset = {
  id: string;
  projectId: string;
  sceneId: string;
  kind: AssetKind;
  filePath: string;
  provider?: string;
  mimeType?: string;
  duration?: number;
  source?: AssetSource;
  sourcePrompt?: string;
};

export type AssetJob = {
  id: string;
  projectId: string;
  sceneId: string;
  kind: AssetKind;
  prompt: string;
  status: AssetJobStatus;
  attempts: number;
  outputAssetId?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

export type AssetPlan = {
  projectId: string;
  jobs: AssetJob[];
  assets: GeneratedAsset[];
};

export type ContentProject = {
  schemaVersion: 1;
  id: string;
  title: string;
  brief: ContentBrief;
  script: string;
  scenes: ContentScene[];
  createdAt: string;
  updatedAt: string;
  generation?: {
    provider: "openai";
    model: string;
  };
  assetPlan?: AssetPlan;
};

export type ContentBatchStatus = "queued" | "preparing" | "ready" | "generating-assets" | "assets-ready" | "failed";

export type ContentBatchItem = {
  id: string;
  brief: ContentBrief;
  status: ContentBatchStatus;
  project?: ContentProject;
  error?: string;
};

export type ContentBatch = {
  id: string;
  createdAt: string;
  updatedAt: string;
  items: ContentBatchItem[];
};
