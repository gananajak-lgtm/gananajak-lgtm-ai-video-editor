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
};
