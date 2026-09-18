import { contextBridge, ipcRenderer } from "electron";
import type { DesktopApi } from "../shared/types.js";

const api: DesktopApi = {
  selectImages: () => ipcRenderer.invoke("media:select-images"),
  selectNarration: () => ipcRenderer.invoke("media:select-narration")
};

contextBridge.exposeInMainWorld("videoEditor", api);
