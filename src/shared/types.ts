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

export type AudioLayerKind = "sfx" | "music" | "ambience";

export type AudioAsset = {
  id: string;
  filePath: string;
  duration: number;
};

export type AudioLayer = {
  id: string;
  filePath: string;
  kind: AudioLayerKind;
  start: number;
  duration: number;
  volume: number;
  loop: boolean;
  fadeIn: number;
  fadeOut: number;
};

export type TimelinePlan = {
  duration: number;
  narration: string;
  width: number;
  height: number;
  fps: number;
  clips: TimelineClip[];
  audioLayers: AudioLayer[];
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
  selectAudioLayers: () => Promise<AudioAsset[]>;
  buildTimeline: (images: string[], narration: string) => Promise<TimelinePlan>;
  getAiSettingsStatus: () => Promise<AiSettingsStatus>;
  saveOpenAiApiKey: (apiKey: string) => Promise<AiSettingsStatus>;
  transcribeNarration: (narrationPath: string) => Promise<TranscriptResult>;
  chooseOutput: () => Promise<string | null>;
  renderTimeline: (plan: TimelinePlan, outputPath: string) => Promise<RenderResult>;
};
