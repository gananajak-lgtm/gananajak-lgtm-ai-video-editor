import { app, BrowserWindow, dialog, ipcMain, nativeImage } from "electron";
import path from "node:path";
import type { AudioAsset, ProjectDocument, SceneBlock, TimelinePlan, TranscriptResult, VisualBrainPlan } from "../shared/types";
import { transcribeLongNarration } from "./ai/transcription";
import { buildEditingBrainPlan } from "./editing/editingBrain";
import { getAiSettingsStatus, saveOpenAiApiKey } from "./settings";
import {
  autosaveProject,
  loadAutosaveProject,
  openProject,
  relinkMissingMediaFromFolder,
  relinkSingleMedia,
  saveProject
} from "./projectStore";
import { buildTimelineFromVisualPlan } from "./visual/timelineAdapter";
import { buildVisualBrainPlan } from "./visual/visualBrain";
import { probeDuration } from "./video/probe";
import { renderTimeline } from "./video/render";
import { buildAutomaticTimeline } from "./video/timeline";

const isDev = !app.isPackaged;

function createWindow() {
  const preloadPath = path.join(__dirname, "../preload/index.js");

  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 700,
    backgroundColor: "#0b1020",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    void window.loadURL("http://localhost:5173");
  } else {
    void window.loadFile(path.join(__dirname, "../../dist/index.html"));
  }
}

ipcMain.handle("media:select-images", async () => {
  const result = await dialog.showOpenDialog({
    title: "Select story images",
    properties: ["openFile", "multiSelections"],
    filters: [
      {
        name: "Images",
        extensions: ["png", "jpg", "jpeg", "webp"]
      }
    ]
  });

  return result.canceled ? [] : result.filePaths;
});

ipcMain.handle("media:image-preview", async (_event, filePath: string) => {
  const image = nativeImage.createFromPath(filePath);
  if (image.isEmpty()) return null;

  const size = image.getSize();
  const width = Math.min(960, Math.max(1, size.width));
  return image.resize({ width }).toDataURL();
});

ipcMain.handle("media:select-narration", async () => {
  const result = await dialog.showOpenDialog({
    title: "Select narration audio",
    properties: ["openFile"],
    filters: [
      {
        name: "Audio",
        extensions: ["mp3", "wav", "m4a", "aac", "flac", "ogg"]
      }
    ]
  });

  return result.canceled ? null : result.filePaths[0] ?? null;
});

ipcMain.handle("media:select-audio-layers", async () => {
  const result = await dialog.showOpenDialog({
    title: "Select sound effects, ambience, or music",
    properties: ["openFile", "multiSelections"],
    filters: [
      {
        name: "Audio",
        extensions: ["mp3", "wav", "m4a", "aac", "flac", "ogg"]
      }
    ]
  });

  if (result.canceled) return [];

  const assets: AudioAsset[] = [];
  for (const [index, filePath] of result.filePaths.entries()) {
    const duration = await probeDuration(filePath);
    assets.push({
      id: `audio-asset-${Date.now()}-${index}`,
      filePath,
      duration
    });
  }

  return assets;
});

ipcMain.handle("project:open", async () => {
  return openProject();
});

ipcMain.handle(
  "project:save",
  async (
    _event,
    project: ProjectDocument,
    filePath?: string | null
  ) => {
    return saveProject(project, filePath);
  }
);

ipcMain.handle(
  "project:autosave",
  async (_event, project: ProjectDocument) => {
    await autosaveProject(project);
  }
);

ipcMain.handle("project:load-autosave", async () => {
  return loadAutosaveProject();
});

ipcMain.handle(
  "project:relink-folder",
  async (
    _event,
    project: ProjectDocument,
    missingMedia: string[]
  ) => {
    return relinkMissingMediaFromFolder(project, missingMedia);
  }
);

ipcMain.handle(
  "project:relink-single",
  async (
    _event,
    project: ProjectDocument,
    missingPath: string
  ) => {
    return relinkSingleMedia(project, missingPath);
  }
);

ipcMain.handle("ai:settings-status", async () => {
  return getAiSettingsStatus();
});

ipcMain.handle("ai:save-openai-key", async (_event, apiKey: string) => {
  return saveOpenAiApiKey(apiKey);
});

ipcMain.handle("ai:transcribe-narration", async (_event, narrationPath: string) => {
  return transcribeLongNarration(narrationPath);
});

ipcMain.handle(
  "editing:build-brain-plan",
  async (_event, transcript: TranscriptResult, sfxLibrary: AudioAsset[]) => {
    return buildEditingBrainPlan(transcript, sfxLibrary);
  }
);

ipcMain.handle(
  "visual:build-plan",
  async (_event, scenes: SceneBlock[], imagePaths: string[]) => {
    return buildVisualBrainPlan(scenes, imagePaths);
  }
);

ipcMain.handle(
  "visual:build-timeline",
  async (
    _event,
    narrationPath: string,
    plan: VisualBrainPlan,
    transcript: TranscriptResult
  ) => {
    return buildTimelineFromVisualPlan(narrationPath, plan, transcript);
  }
);

ipcMain.handle(
  "timeline:build",
  async (
    _event,
    images: string[],
    narration: string,
    transcript?: TranscriptResult | null
  ) => {
    return buildAutomaticTimeline(images, narration, transcript);
  }
);

ipcMain.handle("render:choose-output", async () => {
  const result = await dialog.showSaveDialog({
    title: "Export video",
    defaultPath: "story-video.mp4",
    filters: [{ name: "MP4 Video", extensions: ["mp4"] }]
  });

  return result.canceled ? null : result.filePath ?? null;
});

ipcMain.handle(
  "render:timeline",
  async (_event, plan: TimelinePlan, outputPath: string) => {
    const renderedPath = await renderTimeline(plan, outputPath);
    return { outputPath: renderedPath };
  }
);

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
