import { app, BrowserWindow, dialog, ipcMain, nativeImage, shell } from "electron";
import path from "node:path";
import type { ContentBrief } from "../shared/content-factory";
import type { AudioAsset, ProjectDocument, SceneBlock, TimelinePlan, TranscriptResult, VisualBrainPlan } from "../shared/types";
import { generateContentProject } from "./ai/contentGeneration";
import { transcribeLongNarration } from "./ai/transcription";
import { buildEditingBrainPlan } from "./editing/editingBrain";
import { assembleNarrationAndTimeline } from "./content-narration-runner";
import { importMetaVideo } from "./providers/meta-manual-video-provider";
import { createDefaultAssetProviderRegistry } from "./providers/default-provider-registry";
import { runAssetPlan } from "./content-asset-runner";
import { buildAssetPlan } from "./content-asset-planner";
import { createContentBatch, prepareContentBatch } from "./content-batch";
import { generateBatchAssets } from "./content-batch-assets";
import { renderContentBatch } from "./content-batch-render";
import {
  createPlaybackUrl,
  installMediaProtocol
} from "./mediaProtocol";
import { getAiSettingsStatus, saveOpenAiApiKey, getReplicateApiToken, saveReplicateApiToken, getElevenLabsApiKey, saveElevenLabsApiKey } from "./settings";
import {
  autosaveProject,
  findMissingMedia,
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
import { verifyRenderedOutput } from "./video/renderVerification";
import { analyzeRenderPlan } from "./video/renderDiagnostics";
import { createPreviewTimeline } from "./video/previewPlan";
import { renderQcPack } from "./video/qcPack";
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
  "project:check-media",
  async (_event, project: ProjectDocument) => {
    return findMissingMedia(project);
  }
);

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

async function contentProviderStatus() {
  return {
    replicateConfigured: Boolean(await getReplicateApiToken()),
    elevenLabsConfigured: Boolean(await getElevenLabsApiKey())
  };
}

ipcMain.handle("content:provider-status", contentProviderStatus);
ipcMain.handle("content:save-replicate-token", async (_event, token: string) => {
  await saveReplicateApiToken(token);
  return contentProviderStatus();
});
ipcMain.handle("content:save-elevenlabs-key", async (_event, apiKey: string) => {
  await saveElevenLabsApiKey(apiKey);
  return contentProviderStatus();
});

ipcMain.handle("content:generate-project", async (_event, brief: ContentBrief) => {
  return generateContentProject(brief);
});

ipcMain.handle("content:prepare-batch", async (event, briefs: ContentBrief[]) => {
  return prepareContentBatch(createContentBatch(briefs), generateContentProject, (completed, total, item) => {
    if (!event.sender.isDestroyed()) event.sender.send("content:batch-progress", { completed, total, item });
  });
});

ipcMain.handle("content:resume-batch", async (event, batch: import("../shared/content-factory").ContentBatch) => {
  return prepareContentBatch(batch, generateContentProject, (completed, total, item) => {
    if (!event.sender.isDestroyed()) event.sender.send("content:batch-progress", { completed, total, item });
  });
});

ipcMain.handle("content:choose-batch-output", async () => {
  const result = await dialog.showOpenDialog({ title:"Choose folder for batch videos", properties:["openDirectory","createDirectory"] });
  return result.canceled ? null : result.filePaths[0] ?? null;
});

ipcMain.handle("content:render-batch", async (event, batch: import("../shared/content-factory").ContentBatch, outputDir:string) => {
  const workRoot=path.join(app.getPath("temp"),"gananajak-content-factory","batch-render");
  const result=await renderContentBatch(batch,outputDir,workRoot,(progress)=>{
    if(!event.sender.isDestroyed()) event.sender.send("content:batch-render-progress",progress);
  });
  if(result.items.some(item=>item.status==="rendered")) await shell.openPath(outputDir);
  return result;
});

ipcMain.handle("content:generate-batch-assets", async (event, batch: import("../shared/content-factory").ContentBatch) => {
  const rootDir = path.join(app.getPath("userData"), "content-assets");
  return generateBatchAssets(batch, createDefaultAssetProviderRegistry(), rootDir, (progress) => {
    if (!event.sender.isDestroyed()) event.sender.send("content:batch-asset-progress", progress);
  });
});

ipcMain.handle("content:generate-assets", async (event, project: import("../shared/content-factory").ContentProject) => {
  const planned = project.assetPlan ?? buildAssetPlan(project, { includeVideo: true, includeSfx: false });
  const workDir = path.join(app.getPath("userData"), "content-assets", project.id);
  const assetPlan = await runAssetPlan(planned, createDefaultAssetProviderRegistry(), workDir, (progress) => {
    if (!event.sender.isDestroyed()) event.sender.send("content:asset-progress", progress);
  });
  return { ...project, assetPlan, updatedAt: new Date().toISOString() };
});

ipcMain.handle("content:import-meta-video", async (_event, project: import("../shared/content-factory").ContentProject, sceneId: string) => {
  const job = project.assetPlan?.jobs.find((candidate) => candidate.sceneId === sceneId && candidate.kind === "video");
  if (!job) throw new Error(`No video asset job found for scene ${sceneId}.`);
  const result = await dialog.showOpenDialog({ title: "Import Meta AI video", properties: ["openFile"], filters: [{ name: "Video", extensions: ["mp4", "mov", "webm", "mkv"] }] });
  if (result.canceled || !result.filePaths[0]) return null;
  const workDir = path.join(app.getPath("userData"), "content-assets", project.id);
  const asset = await importMetaVideo(job, result.filePaths[0], workDir);
  const jobs = project.assetPlan!.jobs.map((candidate) => candidate.id === job.id ? { ...candidate, status: "succeeded" as const, outputAssetId: asset.id, error: undefined, updatedAt: new Date().toISOString() } : candidate);
  return { ...project, updatedAt: new Date().toISOString(), assetPlan: { ...project.assetPlan!, jobs, assets: [...project.assetPlan!.assets.filter((existing) => existing.id !== asset.id && !(existing.sceneId === sceneId && existing.kind === "video")), asset] } };
});

ipcMain.handle(
  "content:assemble-and-render",
  async (event, project: import("../shared/content-factory").ContentProject, outputPath: string) => {
    const workDir = path.join(app.getPath("temp"), "gananajak-content-factory", project.id);
    const assembled = await assembleNarrationAndTimeline(project, workDir);
    const renderedPath = await renderTimeline(
      assembled.timeline,
      outputPath,
      (progress) => {
        if (!event.sender.isDestroyed()) event.sender.send("render:progress", progress);
      }
    );
    const testReport = await verifyRenderedOutput(assembled.timeline, renderedPath);
    return { outputPath: renderedPath, narrationPath: assembled.narrationPath, timeline: assembled.timeline, testReport };
  }
);

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

ipcMain.handle(
  "render:analyze-plan",
  async (_event, plan: TimelinePlan) => {
    return analyzeRenderPlan(plan);
  }
);

ipcMain.handle(
  "render:preview",
  async (
    event,
    plan: TimelinePlan,
    start: number,
    duration: number
  ) => {
    const previewPlan = createPreviewTimeline(plan, start, duration);
    const outputPath = path.join(
      app.getPath("temp"),
      "gananajak-ai-video-editor-preview.mp4"
    );

    const renderedPath = await renderTimeline(
      previewPlan,
      outputPath,
      (progress) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send("render:progress", progress);
        }
      }
    );

    return {
      outputPath: renderedPath,
      playbackUrl: createPlaybackUrl(renderedPath)
    };
  }
);

ipcMain.handle(
  "render:qc-pack",
  async (
    event,
    plan: TimelinePlan,
    sampleDuration: number
  ) => {
    const result = await dialog.showOpenDialog({
      title: "Choose folder for QC preview pack",
      properties: ["openDirectory", "createDirectory"]
    });

    if (result.canceled || !result.filePaths[0]) return null;

    const folderPath = result.filePaths[0];
    const pack = await renderQcPack(
      plan,
      folderPath,
      sampleDuration,
      (progress) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send("render:qc-progress", progress);
        }
      }
    );

    await shell.openPath(folderPath);
    return pack;
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
  async (event, plan: TimelinePlan, outputPath: string) => {
    const renderedPath = await renderTimeline(
      plan,
      outputPath,
      (progress) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send("render:progress", progress);
        }
      }
    );

    const testReport = await verifyRenderedOutput(plan, renderedPath);
    return {
      outputPath: renderedPath,
      testReport
    };
  }
);

app.whenReady().then(() => {
  installMediaProtocol();
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
