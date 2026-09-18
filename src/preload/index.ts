import { contextBridge, ipcRenderer } from "electron";
import type { DesktopApi, TimelinePlan } from "../shared/types";

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
  transcribeNarration: (narrationPath) =>
    ipcRenderer.invoke("ai:transcribe-narration", narrationPath),
  buildEditingBrainPlan: (transcript, sfxLibrary) =>
    ipcRenderer.invoke("editing:build-brain-plan", transcript, sfxLibrary),
  buildVisualBrainPlan: (scenes, imagePaths) =>
    ipcRenderer.invoke("visual:build-plan", scenes, imagePaths),
  buildTimelineFromVisualPlan: (narrationPath, plan, transcript) =>
    ipcRenderer.invoke("visual:build-timeline", narrationPath, plan, transcript),
  chooseOutput: () => ipcRenderer.invoke("render:choose-output"),
  renderTimeline: (plan: TimelinePlan, outputPath: string) =>
    ipcRenderer.invoke("render:timeline", plan, outputPath)
};

contextBridge.exposeInMainWorld("videoEditor", api);
