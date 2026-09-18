import { contextBridge, ipcRenderer } from "electron";
import type { DesktopApi, TimelinePlan } from "../shared/types";

const api: DesktopApi = {
  selectImages: () => ipcRenderer.invoke("media:select-images"),
  selectNarration: () => ipcRenderer.invoke("media:select-narration"),
  selectAudioLayers: () => ipcRenderer.invoke("media:select-audio-layers"),
  buildTimeline: (images, narration) =>
    ipcRenderer.invoke("timeline:build", images, narration),
  getAiSettingsStatus: () => ipcRenderer.invoke("ai:settings-status"),
  saveOpenAiApiKey: (apiKey) =>
    ipcRenderer.invoke("ai:save-openai-key", apiKey),
  transcribeNarration: (narrationPath) =>
    ipcRenderer.invoke("ai:transcribe-narration", narrationPath),
  buildEditingBrainPlan: (transcript, sfxLibrary) =>
    ipcRenderer.invoke("editing:build-brain-plan", transcript, sfxLibrary),
  buildVisualBrainPlan: (scenes, imagePaths) =>
    ipcRenderer.invoke("visual:build-plan", scenes, imagePaths),
  buildTimelineFromVisualPlan: (narrationPath, plan) =>
    ipcRenderer.invoke("visual:build-timeline", narrationPath, plan),
  chooseOutput: () => ipcRenderer.invoke("render:choose-output"),
  renderTimeline: (plan: TimelinePlan, outputPath: string) =>
    ipcRenderer.invoke("render:timeline", plan, outputPath)
};

contextBridge.exposeInMainWorld("videoEditor", api);
