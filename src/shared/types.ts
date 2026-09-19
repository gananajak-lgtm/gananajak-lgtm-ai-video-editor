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

export type ProjectDocument = {
  schemaVersion: 1;
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  images: string[];
  narration: string | null;
  transcript: TranscriptResult | null;
  editingPlan: EditingBrainPlan | null;
  timeline: TimelinePlan | null;
  audioLayers: AudioLayer[];
  renderHistory?: FullEpisodeTestReport[];
};

export type ProjectLoadResult = {
  project: ProjectDocument;
  filePath: string | null;
  missingMedia: string[];
};

export type ProjectSaveResult = {
  filePath: string;
};

export type MediaRelink = {
  from: string;
  to: string;
};

export type ProjectRelinkResult = {
  project: ProjectDocument;
  missingMedia: string[];
  relinked: MediaRelink[];
};

export type ShotMotion =
  | "hold"
  | "slow-zoom-in"
  | "slow-zoom-out"
  | "pan-left"
  | "pan-right";

export type ShotType = "close" | "medium" | "wide" | "unknown";

export type TimelineClip = {
  id: string;
  imagePath: string;
  start: number;
  duration: number;
  motion: ShotMotion;
};

export type AudioLayerKind = "sfx" | "music" | "ambience";
export type AudioLayerOrigin = "manual" | "auto-sfx";

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
  sourceOffset?: number;
  origin?: AudioLayerOrigin;
  label?: string;
};

export type RenderQuality = "draft" | "standard" | "high";

export type SubtitlePosition = "bottom" | "middle";

export type SubtitleStyle = {
  fontFamily: string;
  scale: number;
  position: SubtitlePosition;
};

export type SubtitleCue = {
  id: string;
  start: number;
  end: number;
  text: string;
};

export type TimelinePlan = {
  duration: number;
  narration: string;
  width: number;
  height: number;
  fps: number;
  clips: TimelineClip[];
  audioLayers: AudioLayer[];
  subtitles: SubtitleCue[];
  transitionDuration: number;
  quality: RenderQuality;
  subtitleStyle?: SubtitleStyle;
  exportSubtitleSidecar?: boolean;
  narrationOffset?: number;
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

export type SceneBlock = {
  id: string;
  start: number;
  end: number;
  duration: number;
  text: string;
  segmentIds: string[];
  recommendedShotCount: number;
  minShotDuration: number;
};

export type SfxCue = {
  id: string;
  label: string;
  start: number;
  triggerText: string;
  matchedAssetId: string | null;
  matchedFilePath: string | null;
};

export type EditingBrainPlan = {
  scenes: SceneBlock[];
  sfxCues: SfxCue[];
  automaticAudioLayers: AudioLayer[];
};

export type ImageDescriptor = {
  id: string;
  filePath: string;
  summary: string;
  characters: string[];
  actions: string[];
  setting: string[];
  mood: string[];
  shotType: ShotType;
};

export type SceneImageMatch = {
  sceneId: string;
  imageId: string;
  score: number;
  reason: string;
};

export type PlannedShot = {
  id: string;
  sceneId: string;
  imageId: string;
  imagePath: string;
  start: number;
  duration: number;
  motion: ShotMotion;
  reason: string;
};

export type VisualBrainPlan = {
  descriptors: ImageDescriptor[];
  matches: SceneImageMatch[];
  shots: PlannedShot[];
};

export type AiSettingsStatus = {
  configured: boolean;
  persistedSecurely: boolean;
};

export type RenderProgress = {
  progress: number;
  elapsed: number;
  duration: number;
};

export type RenderDiagnosticLevel = "info" | "warning" | "error";

export type RenderDiagnostic = {
  id: string;
  level: RenderDiagnosticLevel;
  message: string;
};

export type RenderDiagnostics = {
  ready: boolean;
  clipCount: number;
  subtitleCount: number;
  audioLayerCount: number;
  duration: number;
  estimatedFrames: number;
  megapixelsPerFrame: number;
  diagnostics: RenderDiagnostic[];
};

export type QcSample = {
  id: string;
  label: string;
  start: number;
  duration: number;
  outputPath: string;
};

export type QcPackResult = {
  folderPath: string;
  samples: QcSample[];
};

export type QcPackProgress = {
  sampleIndex: number;
  totalSamples: number;
  label: string;
  sampleProgress: number;
  overallProgress: number;
};

export type FullEpisodeTestReport = {
  id: string;
  createdAt: string;
  outputPath: string;
  reportPath: string;
  passed: boolean;
  expectedDuration: number;
  actualDuration: number;
  durationDelta: number;
  fileSizeBytes: number;
  width: number | null;
  height: number | null;
  fps: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  videoDuration: number | null;
  audioDuration: number | null;
  avSyncDelta: number | null;
  frameCount: number | null;
  expectedFrames: number;
  diagnostics: RenderDiagnostic[];
};

export type RenderResult = {
  outputPath: string;
  testReport?: FullEpisodeTestReport;
};

export type DesktopApi = {
  selectImages: () => Promise<string[]>;
  selectNarration: () => Promise<string | null>;
  readImagePreview: (filePath: string) => Promise<string | null>;
  selectAudioLayers: () => Promise<AudioAsset[]>;
  openProject: () => Promise<ProjectLoadResult | null>;
  saveProject: (
    project: ProjectDocument,
    filePath?: string | null
  ) => Promise<ProjectSaveResult | null>;
  autosaveProject: (project: ProjectDocument) => Promise<void>;
  loadAutosaveProject: () => Promise<ProjectLoadResult | null>;
  relinkMissingMediaFromFolder: (
    project: ProjectDocument,
    missingMedia: string[]
  ) => Promise<ProjectRelinkResult | null>;
  relinkSingleMedia: (
    project: ProjectDocument,
    missingPath: string
  ) => Promise<ProjectRelinkResult | null>;
  checkProjectMedia: (project: ProjectDocument) => Promise<string[]>;
  buildTimeline: (
    images: string[],
    narration: string,
    transcript?: TranscriptResult | null
  ) => Promise<TimelinePlan>;
  getAiSettingsStatus: () => Promise<AiSettingsStatus>;
  saveOpenAiApiKey: (apiKey: string) => Promise<AiSettingsStatus>;
  transcribeNarration: (narrationPath: string) => Promise<TranscriptResult>;
  buildEditingBrainPlan: (
    transcript: TranscriptResult,
    sfxLibrary: AudioAsset[]
  ) => Promise<EditingBrainPlan>;
  buildVisualBrainPlan: (
    scenes: SceneBlock[],
    imagePaths: string[]
  ) => Promise<VisualBrainPlan>;
  buildTimelineFromVisualPlan: (
    narrationPath: string,
    plan: VisualBrainPlan,
    transcript: TranscriptResult
  ) => Promise<TimelinePlan>;
  analyzeRenderPlan: (plan: TimelinePlan) => Promise<RenderDiagnostics>;
  renderPreview: (
    plan: TimelinePlan,
    start: number,
    duration: number
  ) => Promise<RenderResult>;
  renderQcPack: (
    plan: TimelinePlan,
    sampleDuration: number
  ) => Promise<QcPackResult | null>;
  chooseOutput: () => Promise<string | null>;
  renderTimeline: (plan: TimelinePlan, outputPath: string) => Promise<RenderResult>;
  onRenderProgress: (
    listener: (progress: RenderProgress) => void
  ) => () => void;
  onQcPackProgress: (
    listener: (progress: QcPackProgress) => void
  ) => () => void;
};
