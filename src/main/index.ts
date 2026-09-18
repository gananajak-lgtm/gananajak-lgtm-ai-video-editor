import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from "node:path";
import type { TimelinePlan } from "../shared/types";
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

ipcMain.handle(
  "timeline:build",
  async (_event, images: string[], narration: string) => {
    return buildAutomaticTimeline(images, narration);
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
