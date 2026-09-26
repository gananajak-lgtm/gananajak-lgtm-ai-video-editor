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

export type PublishStatus = "draft" | "ready" | "scheduled" | "publishing" | "published" | "failed";

export type PublishPlatform = "youtube" | "tiktok" | "facebook" | "instagram";
export type TikTokPrivacyLevel = "PUBLIC_TO_EVERYONE" | "MUTUAL_FOLLOW_FRIENDS" | "FOLLOWER_OF_CREATOR" | "SELF_ONLY";

export type PublishAccount = {
  platform: PublishPlatform;
  status: "disconnected" | "connected" | "error";
  displayName?: string;
  connectedAt?: string;
  error?: string;
};

export type PublishJobStatus = "queued" | "blocked" | "publishing" | "published" | "failed";

export type PublishResult = {
  platform: PublishPlatform;
  status: "published" | "failed";
  externalId?: string;
  url?: string;
  publishedAt?: string;
  error?: string;
};

export type PublishJob = {
  id: string;
  itemId: string;
  platform: PublishPlatform;
  status: PublishJobStatus;
  scheduledAt?: string;
  attempts: number;
  result?: PublishResult;
  externalPublishId?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

export type PublishPlan = {
  status: PublishStatus;
  title?: string;
  description?: string;
  caption?: string;
  hashtags?: string[];
  platforms?: PublishPlatform[];
  scheduledAt?: string;
  publishedAt?: string;
  error?: string;
  tiktok?: { privacyLevel?:TikTokPrivacyLevel; disableComment?:boolean; disableDuet?:boolean; disableStitch?:boolean; creatorNickname?:string; isAigc?:boolean; commercialContent?:boolean; brandOrganic?:boolean; brandedContent?:boolean; musicUsageConfirmed?:boolean };
};

export type ContentBatchStatus = "queued" | "preparing" | "ready" | "generating-assets" | "assets-ready" | "rendering" | "rendered" | "failed";

export type ContentBatchItem = {
  id: string;
  brief: ContentBrief;
  status: ContentBatchStatus;
  project?: ContentProject;
  error?: string;
  outputPath?: string;
  failedStage?: "project" | "assets" | "render";
  publish?: PublishPlan;
};

export type ContentBatch = {
  id: string;
  createdAt: string;
  updatedAt: string;
  items: ContentBatchItem[];
};
