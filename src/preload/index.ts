import { contextBridge, ipcRenderer } from "electron";
import type { IpcRendererEvent } from "electron";
import type {
  DesktopApi,
  QcPackProgress,
  RenderProgress,
  TimelinePlan
} from "../shared/types";

const api: DesktopApi = {
  selectImages: () => ipcRenderer.invoke("media:select-images"),
  selectNarration: () => ipcRenderer.invoke("media:select-narration"),
  readImagePreview: (filePath) =>
    ipcRenderer.invoke("media:image-preview", filePath),
  selectAudioLayers: () => ipcRenderer.invoke("media:select-audio-layers"),
  openProject: () => ipcRenderer.invoke("project:open"),
  saveProject: (project, filePath) =>
    ipcRenderer.invoke("project:save", project, filePath),
  autosaveProject: (project) =>
    ipcRenderer.invoke("project:autosave", project),
  loadAutosaveProject: () =>
    ipcRenderer.invoke("project:load-autosave"),
  relinkMissingMediaFromFolder: (project, missingMedia) =>
    ipcRenderer.invoke("project:relink-folder", project, missingMedia),
  relinkSingleMedia: (project, missingPath) =>
    ipcRenderer.invoke("project:relink-single", project, missingPath),
  checkProjectMedia: (project) =>
    ipcRenderer.invoke("project:check-media", project),
  buildTimeline: (images, narration, transcript) =>
    ipcRenderer.invoke("timeline:build", images, narration, transcript),
  getAiSettingsStatus: () => ipcRenderer.invoke("ai:settings-status"),
  saveOpenAiApiKey: (apiKey) =>
    ipcRenderer.invoke("ai:save-openai-key", apiKey),
  getContentProviderStatus: () => ipcRenderer.invoke("content:provider-status"),
  saveReplicateApiToken: (token) => ipcRenderer.invoke("content:save-replicate-token", token),
  saveElevenLabsApiKey: (apiKey) => ipcRenderer.invoke("content:save-elevenlabs-key", apiKey),
  generateContentProject: (brief) =>
    ipcRenderer.invoke("content:generate-project", brief),
  generateLocalTestProject: (brief) =>
    ipcRenderer.invoke("content:generate-local-test-project", brief),
  prepareContentBatch: (briefs) =>
    ipcRenderer.invoke("content:prepare-batch", briefs),
  loadContentBatch: () => ipcRenderer.invoke("content:load-batch"),
  resumeContentBatch: (batch) =>
    ipcRenderer.invoke("content:resume-batch", batch),
  generateContentBatchAssets: (batch) =>
    ipcRenderer.invoke("content:generate-batch-assets", batch),
  chooseBatchOutputFolder: () => ipcRenderer.invoke("content:choose-batch-output"),
  renderContentBatch: (batch, outputDir) => ipcRenderer.invoke("content:render-batch", batch, outputDir),
  importMetaVideo: (project, sceneId) =>
    ipcRenderer.invoke("content:import-meta-video", project, sceneId),
  generateContentAssets: (project) =>
    ipcRenderer.invoke("content:generate-assets", project),
  assembleAndRenderContent: (project, outputPath) =>
    ipcRenderer.invoke("content:assemble-and-render", project, outputPath),
  transcribeNarration: (narrationPath) =>
    ipcRenderer.invoke("ai:transcribe-narration", narrationPath),
  buildEditingBrainPlan: (transcript, sfxLibrary) =>
    ipcRenderer.invoke("editing:build-brain-plan", transcript, sfxLibrary),
  buildVisualBrainPlan: (scenes, imagePaths) =>
    ipcRenderer.invoke("visual:build-plan", scenes, imagePaths),
  buildTimelineFromVisualPlan: (narrationPath, plan, transcript) =>
    ipcRenderer.invoke("visual:build-timeline", narrationPath, plan, transcript),
  analyzeRenderPlan: (plan) =>
    ipcRenderer.invoke("render:analyze-plan", plan),
  renderPreview: (plan, start, duration) =>
    ipcRenderer.invoke("render:preview", plan, start, duration),
  renderQcPack: (plan, sampleDuration) =>
    ipcRenderer.invoke("render:qc-pack", plan, sampleDuration),
  chooseOutput: () => ipcRenderer.invoke("render:choose-output"),
  renderTimeline: (plan: TimelinePlan, outputPath: string) =>
    ipcRenderer.invoke("render:timeline", plan, outputPath),
  onContentBatchRenderProgress: (listener) => {
    const handler = (_event: IpcRendererEvent, progress: Parameters<typeof listener>[0]) => listener(progress);
    ipcRenderer.on("content:batch-render-progress", handler);
    return () => ipcRenderer.removeListener("content:batch-render-progress", handler);
  },
  onContentBatchAssetProgress: (listener) => {
    const handler = (_event: IpcRendererEvent, progress: Parameters<typeof listener>[0]) => listener(progress);
    ipcRenderer.on("content:batch-asset-progress", handler);
    return () => ipcRenderer.removeListener("content:batch-asset-progress", handler);
  },
  onContentBatchProgress: (listener) => {
    const handler = (_event: IpcRendererEvent, progress: Parameters<typeof listener>[0]) => listener(progress);
    ipcRenderer.on("content:batch-progress", handler);
    return () => ipcRenderer.removeListener("content:batch-progress", handler);
  },
  onContentAssetProgress: (listener) => {
    const handler = (
      _event: IpcRendererEvent,
      progress: { completed: number; total: number; currentJobId?: string; kind?: string }
    ) => listener(progress);

    ipcRenderer.on("content:asset-progress", handler);
    return () => ipcRenderer.removeListener("content:asset-progress", handler);
  },
  onRenderProgress: (listener) => {
    const handler = (
      _event: IpcRendererEvent,
      progress: RenderProgress
    ) => listener(progress);

    ipcRenderer.on("render:progress", handler);
    return () => ipcRenderer.removeListener("render:progress", handler);
  },
  onQcPackProgress: (listener) => {
    const handler = (
      _event: IpcRendererEvent,
      progress: QcPackProgress
    ) => listener(progress);

    ipcRenderer.on("render:qc-progress", handler);
    return () => ipcRenderer.removeListener("render:qc-progress", handler);
  }
};

contextBridge.exposeInMainWorld("videoEditor", api);
