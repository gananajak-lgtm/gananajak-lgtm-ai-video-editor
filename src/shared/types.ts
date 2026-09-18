export type ProjectMedia = {
  images: string[];
  narration: string | null;
};

export type VideoProject = {
  id: string;
  title: string;
  createdAt: string;
  media: ProjectMedia;
};

export type TimelineClip = {
  id: string;
  imagePath: string;
  start: number;
  duration: number;
  motion: "slow-zoom-in";
};

export type TimelinePlan = {
  duration: number;
  narration: string;
  width: number;
  height: number;
  fps: number;
  clips: TimelineClip[];
};

export type TranscriptSegment = {
  id: string;
  start: number;
  end: number;
  text: string;
};

export type TranscriptResult = {
  provider: "openai-whisper-1";
  language: string | null;
  duration: number;
  text: string;
  segments: TranscriptSegment[];
};

export type AiSettingsStatus = {
  configured: boolean;
  persistedSecurely: boolean;
};

export type RenderResult = {
  outputPath: string;
};

export type DesktopApi = {
  selectImages: () => Promise<string[]>;
  selectNarration: () => Promise<string | null>;
  buildTimeline: (images: string[], narration: string) => Promise<TimelinePlan>;
  getAiSettingsStatus: () => Promise<AiSettingsStatus>;
  saveOpenAiApiKey: (apiKey: string) => Promise<AiSettingsStatus>;
  transcribeNarration: (narrationPath: string) => Promise<TranscriptResult>;
  chooseOutput: () => Promise<string | null>;
  renderTimeline: (plan: TimelinePlan, outputPath: string) => Promise<RenderResult>;
};
