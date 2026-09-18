import { contextBridge, ipcRenderer } from "electron";
import type { DesktopApi, TimelinePlan } from "../shared/types";

const api: DesktopApi = {
  selectImages: () => ipcRenderer.invoke("media:select-images"),
  selectNarration: () => ipcRenderer.invoke("media:select-narration"),
  buildTimeline: (images, narration) =>
    ipcRenderer.invoke("timeline:build", images, narration),
  chooseOutput: () => ipcRenderer.invoke("render:choose-output"),
  renderTimeline: (plan: TimelinePlan, outputPath: string) =>
    ipcRenderer.invoke("render:timeline", plan, outputPath)
};

contextBridge.exposeInMainWorld("videoEditor", api);
