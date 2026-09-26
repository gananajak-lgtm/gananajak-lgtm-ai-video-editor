import { app, BrowserWindow, dialog, ipcMain, nativeImage, shell } from "electron";
import path from "node:path";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import ffmpegPath from "ffmpeg-static";
import { spawn } from "node:child_process";
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
import { buildLocalTestProject } from "./content-scene-planner";
import { generateLocalTestAssets } from "./content-local-test-assets";
import { createContentBatch, prepareContentBatch } from "./content-batch";
import { generateBatchAssets } from "./content-batch-assets";
import { renderContentBatch } from "./content-batch-render";
import { ensurePublishPlan } from "./content-publish-planner";
import { validatePublishItem } from "./content-publish-validation";
import { createPublishJobs, recoverInterruptedPublishJobs, releaseDuePublishJobs } from "./content-publish-jobs";
import { loadPublishQueue, savePublishQueue } from "./content-publish-queue-store";
import { uploadVideoToYouTube } from "./youtube-uploader";
import { refreshYouTubeAccessToken } from "./youtube-oauth";
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
import { createOAuthState, startOAuthLoopback } from "./oauth-loopback";
import { exchangeYouTubeAuthorizationCode } from "./youtube-oauth";
import { loadYouTubeTokens, saveYouTubeTokens, loadYouTubeOAuthConfig, saveYouTubeOAuthConfig } from "./youtube-token-store";
import { createTikTokPkce, exchangeTikTokAuthorizationCode, refreshTikTokAccessToken } from "./tiktok-oauth";
import { queryTikTokCreatorInfo, initTikTokDirectPost, uploadTikTokFile, waitForTikTokPublish, validateTikTokMedia } from "./tiktok-uploader";
import { probeMediaInfo } from "./video/probe";
import { loadTikTokTokens, saveTikTokTokens, loadTikTokOAuthConfig, saveTikTokOAuthConfig } from "./tiktok-token-store";
import { createAffiliateProduct } from "./affiliate-product-import";
import { createAffiliateContentJobs } from "./affiliate-content-jobs";
import { affiliateJobToContentBrief } from "./affiliate-content-planner";
import { loadAffiliateQueue, saveAffiliateQueue } from "./affiliate-queue-store";
import { buildMetaAuthorizationUrl, exchangeMetaAuthorizationCode, exchangeMetaLongLivedToken } from "./meta-oauth";
import { loadMetaOAuthConfig, loadMetaToken, saveMetaOAuthConfig, saveMetaToken } from "./meta-token-store";
import { listMetaPublishingPages } from "./meta-publishing";
import { createFacebookReel, uploadFacebookLocalReel, finishFacebookReel } from "./facebook-reels-uploader";

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

ipcMain.handle("affiliate:load-queue", async () => loadAffiliateQueue());
ipcMain.handle("affiliate:save-queue", async (_event, products:import("../shared/affiliate-factory").AffiliateProduct[], jobs:import("../shared/affiliate-factory").AffiliateContentJob[]) => saveAffiliateQueue({products,jobs}));

ipcMain.handle("affiliate:prepare-batch", async (event, jobs:import("../shared/affiliate-factory").AffiliateContentJob[], language:import("../shared/content-factory").ContentLanguage="th", duration=30) => {
  const briefs=jobs.map((job)=>affiliateJobToContentBrief(job,{language,duration}));
  const result=await prepareContentBatch(createContentBatch(briefs), generateContentProject, async (completed,total,item)=>{
    if (!event.sender.isDestroyed()) event.sender.send("content:batch-progress",{completed,total,item});
  });
  return saveBatchState(result);
});

ipcMain.handle("affiliate:create-local-batch", async (event, jobs:import("../shared/affiliate-factory").AffiliateContentJob[], outputDir:string, language:import("../shared/content-factory").ContentLanguage="th", duration=30) => {
  const briefs=jobs.map((job)=>affiliateJobToContentBrief(job,{language,duration}));
  let batch=createContentBatch(briefs);
  const items=[...batch.items];
  const workRoot=path.join(app.getPath("temp"),"gananajak-content-factory","affiliate-local-test");
  for(let index=0;index<items.length;index+=1){
    const item:import("../shared/content-factory").ContentBatchItem={...items[index]};
    try{
      item.status="preparing";
      const project=buildLocalTestProject(item.brief); item.project=project; item.status="generating-assets";
      const root=path.join(app.getPath("userData"),"content-assets",project.id,"affiliate-local-test");
      item.project=await generateLocalTestAssets(project,root); item.status="assets-ready";
      const rendered=await renderContentBatch({...batch,items:[item]},outputDir,workRoot);
      Object.assign(item,ensurePublishPlan(rendered.items[0]));
    }catch(error){item.status="failed";item.failedStage=item.project?.assetPlan?"render":item.project?"assets":"project";item.error=error instanceof Error?error.message:String(error);}
    items[index]=item;batch={...batch,items,updatedAt:new Date().toISOString()};await saveBatchState(batch);
    if(!event.sender.isDestroyed()) event.sender.send("content:batch-progress",{completed:index+1,total:items.length,item});
  }
  if(batch.items.some((item)=>item.status==="rendered")) await shell.openPath(outputDir);
  return batch;
});

ipcMain.handle("affiliate:create-jobs", async (_event, products:import("../shared/affiliate-factory").AffiliateProduct[]) => createAffiliateContentJobs(products));

ipcMain.handle("affiliate:import-product", async (_event, sourceUrl:string) => createAffiliateProduct({sourceUrl}));

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
ipcMain.handle("content:generate-local-test-project", async (_event, brief: ContentBrief) => buildLocalTestProject(brief));
ipcMain.handle("content:generate-local-test-assets", async (_event, project: import("../shared/content-factory").ContentProject) => {
  const root = path.join(app.getPath("userData"), "content-assets", project.id, "local-test");
  return generateLocalTestAssets(project, root);
});

const batchStatePath = () => path.join(app.getPath("userData"), "content-factory", "last-batch.json");
async function saveBatchState(batch: import("../shared/content-factory").ContentBatch) { await mkdir(path.dirname(batchStatePath()), { recursive:true }); await writeFile(batchStatePath(), JSON.stringify(batch, null, 2), "utf8"); return batch; }
async function loadBatchState() { try { return JSON.parse(await readFile(batchStatePath(), "utf8")) as import("../shared/content-factory").ContentBatch; } catch { return null; } }
ipcMain.handle("content:load-batch", loadBatchState);

ipcMain.handle("content:prepare-batch", async (event, briefs: ContentBrief[]) => {
  const result = await prepareContentBatch(createContentBatch(briefs), generateContentProject, async (completed, total, item) => {
    if (!event.sender.isDestroyed()) event.sender.send("content:batch-progress", { completed, total, item });
  });
  return saveBatchState(result);
});

ipcMain.handle("content:resume-batch", async (event, batch: import("../shared/content-factory").ContentBatch) => {
  const result = await prepareContentBatch(batch, generateContentProject, (completed, total, item) => {
    if (!event.sender.isDestroyed()) event.sender.send("content:batch-progress", { completed, total, item });
    void saveBatchState({ ...batch, items: batch.items.map((existing) => existing.id === item.id ? item : existing), updatedAt:new Date().toISOString() });
  });
});

ipcMain.handle("content:create-local-test-batch", async (event, briefs: ContentBrief[], outputDir:string) => {
  let batch = createContentBatch(briefs);
  const items = [...batch.items];
  const workRoot = path.join(app.getPath("temp"), "gananajak-content-factory", "local-test-batch");
  for (let index=0; index<items.length; index += 1) {
    const item = { ...items[index] };
    try {
      item.status = "preparing";
      const project = buildLocalTestProject(item.brief);
      item.project = project;
      item.status = "generating-assets";
      const root = path.join(app.getPath("userData"), "content-assets", project.id, "local-test");
      item.project = await generateLocalTestAssets(project, root);
      item.status="assets-ready";
      const rendered=await renderContentBatch({...batch,items:[item]},outputDir,workRoot);
      Object.assign(item, ensurePublishPlan(rendered.items[0]));
    } catch(error) { item.status="failed"; item.failedStage=item.project?.assetPlan?"render":item.project?"assets":"project"; item.error=error instanceof Error?error.message:String(error); }
    items[index]=item; batch={...batch,items,updatedAt:new Date().toISOString()}; await saveBatchState(batch);
    if(!event.sender.isDestroyed()) event.sender.send("content:batch-progress",{completed:index+1,total:items.length,item});
  }
  if (batch.items.some((item) => item.status === "rendered")) await shell.openPath(outputDir);
  return batch;
});

ipcMain.handle("content:resume-local-test-batch", async (event, savedBatch: import("../shared/content-factory").ContentBatch, outputDir:string) => {
  let batch = { ...savedBatch, items:[...savedBatch.items], updatedAt:new Date().toISOString() };
  const items = [...batch.items];
  const workRoot = path.join(app.getPath("temp"), "gananajak-content-factory", "local-test-batch-resume");
  const pendingIndexes = items.map((item,index)=>({item,index})).filter(({item})=>item.status !== "rendered").map(({index})=>index);
  let completed = items.length - pendingIndexes.length;
  for (const index of pendingIndexes) {
    const item: import("../shared/content-factory").ContentBatchItem = { ...items[index], error:undefined, failedStage:undefined };
    try {
      item.status = "preparing";
      const project = item.project ?? buildLocalTestProject(item.brief);
      item.project = project;
      item.status = "generating-assets";
      const root = path.join(app.getPath("userData"), "content-assets", project.id, "local-test");
      item.project = await generateLocalTestAssets(project, root);
      item.status = "assets-ready";
      const rendered = await renderContentBatch({ ...batch, items:[item] }, outputDir, workRoot);
      Object.assign(item, ensurePublishPlan(rendered.items[0]));
    } catch (error) {
      item.status = "failed";
      item.failedStage = item.project?.assetPlan ? "render" : item.project ? "assets" : "project";
      item.error = error instanceof Error ? error.message : String(error);
    }
    items[index] = item;
    completed += 1;
    batch = { ...batch, items, updatedAt:new Date().toISOString() };
    await saveBatchState(batch);
    if (!event.sender.isDestroyed()) event.sender.send("content:batch-progress", { completed, total:items.length, item });
  }
  if (batch.items.some((item) => item.status === "rendered")) await shell.openPath(outputDir);
  return batch;
});

let youtubeOAuthConfig: { clientId:string; clientSecret?:string } | null = null;

ipcMain.handle("content:configure-youtube-oauth", async (_event, clientId:string, clientSecret?:string): Promise<import("../shared/content-factory").PublishAccount[]> => {
  const normalizedClientId = clientId.trim();
  if (!normalizedClientId) throw new Error("YouTube OAuth client ID is required.");
  youtubeOAuthConfig = { clientId:normalizedClientId, clientSecret:clientSecret?.trim() || undefined };
  await saveYouTubeOAuthConfig(youtubeOAuthConfig);
  return [
    { platform:"youtube", status:"disconnected", displayName:"OAuth configured · authorization required" },
    { platform:"tiktok", status:"disconnected" },
    { platform:"facebook", status:"disconnected" },
    { platform:"instagram", status:"disconnected" }
  ];
});

let metaOAuthConfig: import("./meta-oauth").MetaOAuthConfig | null = null;

ipcMain.handle("content:configure-meta-oauth", async (_event, appId:string, appSecret:string, redirectUri:string) => {
  const config={appId:appId.trim(),appSecret:appSecret.trim(),redirectUri:redirectUri.trim()};
  if(!config.appId || !config.appSecret || !config.redirectUri) throw new Error("Meta App ID, App Secret, and exact redirect URI are required.");
  const url=new URL(config.redirectUri);
  if(url.hostname!=="127.0.0.1" || url.protocol!=="http:" || !url.port) throw new Error("Meta desktop redirect URI must use an exact http://127.0.0.1:PORT/path URI.");
  metaOAuthConfig=config; await saveMetaOAuthConfig(config); return true;
});

ipcMain.handle("content:connect-meta", async () => {
  if(!metaOAuthConfig) metaOAuthConfig=await loadMetaOAuthConfig();
  if(!metaOAuthConfig) throw new Error("Configure Meta OAuth before connecting.");
  const configured=new URL(metaOAuthConfig.redirectUri), state=createOAuthState();
  const loopback=await startOAuthLoopback(state,120_000,configured.pathname,Number(configured.port));
  try{
    if(loopback.redirectUri!==metaOAuthConfig.redirectUri) throw new Error("Meta OAuth redirect URI does not match the configured callback exactly.");
    await shell.openExternal(buildMetaAuthorizationUrl({appId:metaOAuthConfig.appId,redirectUri:loopback.redirectUri,state}));
    const callback=await loopback.callback;
    const shortToken=await exchangeMetaAuthorizationCode({...metaOAuthConfig,code:callback.code});
    const longToken=await exchangeMetaLongLivedToken({appId:metaOAuthConfig.appId,appSecret:metaOAuthConfig.appSecret,accessToken:shortToken.access_token});
    await saveMetaToken(longToken);
    return (await listMetaPublishingPages(longToken.access_token)).map(({id,name,instagramBusinessAccountId})=>({id,name,instagramBusinessAccountId}));
  } finally { loopback.close(); }
});

ipcMain.handle("content:get-meta-destinations", async () => {
  const token=await loadMetaToken(); if(!token) return [];
  return (await listMetaPublishingPages(token.access_token)).map(({id,name,instagramBusinessAccountId})=>({id,name,instagramBusinessAccountId}));
});

let tiktokOAuthConfig: { clientKey:string; clientSecret:string } | null = null;

ipcMain.handle("content:configure-tiktok-oauth", async (_event, clientKey:string, clientSecret:string): Promise<import("../shared/content-factory").PublishAccount[]> => {
  const normalizedClientKey=clientKey.trim(), normalizedClientSecret=clientSecret.trim();
  if(!normalizedClientKey || !normalizedClientSecret) throw new Error("TikTok client key and client secret are required.");
  tiktokOAuthConfig={clientKey:normalizedClientKey,clientSecret:normalizedClientSecret};
  await saveTikTokOAuthConfig(tiktokOAuthConfig);
  const youtubeTokens=await loadYouTubeTokens();
  return [
    {platform:"youtube",status:youtubeTokens ? "connected":"disconnected",displayName:youtubeTokens ? "YouTube authorized":undefined},
    {platform:"tiktok",status:"disconnected",displayName:"OAuth configured · authorization required"},
    {platform:"facebook",status:"disconnected"},{platform:"instagram",status:"disconnected"}
  ];
});

ipcMain.handle("content:connect-tiktok", async (): Promise<import("../shared/content-factory").PublishAccount[]> => {
  if(!tiktokOAuthConfig) tiktokOAuthConfig=await loadTikTokOAuthConfig();
  if(!tiktokOAuthConfig) throw new Error("Configure TikTok OAuth before connecting.");
  const state=createOAuthState(), pkce=createTikTokPkce();
  const loopback=await startOAuthLoopback(state,120_000,"/callback/");
  try {
    const params=new URLSearchParams({client_key:tiktokOAuthConfig.clientKey,response_type:"code",scope:"user.info.basic,video.publish",redirect_uri:loopback.redirectUri,state,code_challenge:pkce.challenge,code_challenge_method:"S256"});
    await shell.openExternal(`https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`);
    const callback=await loopback.callback;
    const tokens=await exchangeTikTokAuthorizationCode({clientKey:tiktokOAuthConfig.clientKey,clientSecret:tiktokOAuthConfig.clientSecret,code:callback.code,redirectUri:callback.redirectUri,codeVerifier:pkce.verifier});
    if(!tokens.scope.split(/[\s,]+/).map((scope)=>scope.trim()).filter(Boolean).includes("video.publish")) throw new Error("TikTok authorization did not grant video.publish.");
    await saveTikTokTokens(tokens);
    const youtubeTokens=await loadYouTubeTokens();
    return [{platform:"youtube",status:youtubeTokens ? "connected":"disconnected",displayName:youtubeTokens ? "YouTube authorized":undefined},{platform:"tiktok",status:"connected",displayName:"TikTok authorized"},{platform:"facebook",status:"disconnected"},{platform:"instagram",status:"disconnected"}];
  } finally { loopback.close(); }
});

ipcMain.handle("content:connect-youtube", async (): Promise<import("../shared/content-factory").PublishAccount[]> => {
  if (!youtubeOAuthConfig) youtubeOAuthConfig=await loadYouTubeOAuthConfig();
  if (!youtubeOAuthConfig) throw new Error("Configure YouTube OAuth before connecting.");
  const state=createOAuthState();
  const loopback=await startOAuthLoopback(state);
  try {
    const params=new URLSearchParams({ client_id:youtubeOAuthConfig.clientId, redirect_uri:loopback.redirectUri, response_type:"code", scope:"https://www.googleapis.com/auth/youtube.upload", access_type:"offline", prompt:"consent", state });
    await shell.openExternal(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
    const callback=await loopback.callback;
    const tokens=await exchangeYouTubeAuthorizationCode({ clientId:youtubeOAuthConfig.clientId, clientSecret:youtubeOAuthConfig.clientSecret, code:callback.code, redirectUri:loopback.redirectUri });
    await saveYouTubeTokens(tokens);
    return [{ platform:"youtube", status:"connected", displayName:"YouTube authorized" },{ platform:"tiktok", status:"disconnected" },{ platform:"facebook", status:"disconnected" },{ platform:"instagram", status:"disconnected" }];
  } finally { loopback.close(); }
});

ipcMain.handle("content:get-publish-accounts", async (): Promise<import("../shared/content-factory").PublishAccount[]> => {
  const youtubeTokens=await loadYouTubeTokens();
  const tiktokTokens=await loadTikTokTokens();
  return [
    { platform:"youtube", status:youtubeTokens?.refresh_token || youtubeTokens?.access_token ? "connected" : "disconnected", displayName:youtubeTokens ? "YouTube authorized" : undefined },
    { platform:"tiktok", status:tiktokTokens?.refresh_token || tiktokTokens?.access_token ? "connected" : "disconnected", displayName:tiktokTokens ? "TikTok authorized" : undefined },
    { platform:"facebook", status:"disconnected" },
    { platform:"instagram", status:"disconnected" }
  ];
});

ipcMain.handle("content:validate-publish-item", async (_event, item: import("../shared/content-factory").ContentBatchItem) => validatePublishItem(item));

ipcMain.handle("content:load-publish-jobs", async () => {
  const root=path.join(app.getPath("userData"),"publish");
  const current=await loadPublishQueue(root);
  const recovered=recoverInterruptedPublishJobs(current.jobs);
  const jobs=releaseDuePublishJobs(recovered);
  const changed=jobs.some((job,index)=>job.status!==current.jobs[index]?.status || job.error!==current.jobs[index]?.error);
  return changed ? savePublishQueue(root,jobs) : current;
});
ipcMain.handle("content:create-publish-jobs", async (_event, item: import("../shared/content-factory").ContentBatchItem) => {
  const root = path.join(app.getPath("userData"), "publish");
  const current = await loadPublishQueue(root);
  const replacements = createPublishJobs(item);
  const platforms = new Set(replacements.map((job) => job.platform));
  const jobs = [...current.jobs.filter((job) => job.itemId !== item.id || !platforms.has(job.platform)), ...replacements];
  return savePublishQueue(root, jobs);
});

function broadcastPublishQueue(state: { jobs: import("../shared/content-factory").PublishJob[]; updatedAt: string }) {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send("content:publish-jobs-updated", state);
  }
}

async function getUsableTikTokTokens() {
  let tokens=await loadTikTokTokens();
  if(!tokens) throw new Error("Connect TikTok before publishing.");
  if(tokens.expiresAt<=Date.now()){
    const config=await loadTikTokOAuthConfig();
    if(!config || !tokens.refresh_token || tokens.refreshExpiresAt<=Date.now()) throw new Error("Reconnect TikTok to refresh authorization.");
    const refreshed=await refreshTikTokAccessToken({clientKey:config.clientKey,clientSecret:config.clientSecret,refreshToken:tokens.refresh_token});
    await saveTikTokTokens(refreshed); tokens=await loadTikTokTokens();
    if(!tokens) throw new Error("TikTok authorization refresh failed.");
  }
  return tokens;
}

ipcMain.handle("content:get-tiktok-creator-info", async () => {
  const tokens=await getUsableTikTokTokens();
  return queryTikTokCreatorInfo(tokens.access_token);
});

ipcMain.handle("content:publish-tiktok-job", async (_event, jobId:string, item:import("../shared/content-factory").ContentBatchItem) => {
  const root=path.join(app.getPath("userData"),"publish"), queue=await loadPublishQueue(root);
  const target=queue.jobs.find((job)=>job.id===jobId && job.platform==="tiktok");
  if(!target) throw new Error("TikTok publish job was not found.");
  if(target.status==="publishing") throw new Error("This TikTok upload is already in progress.");
  if(target.status==="published") throw new Error("This TikTok publish job is already complete.");
  if(target.scheduledAt && new Date(target.scheduledAt).getTime()>Date.now()) throw new Error("This publish job is scheduled for a future time.");
  const tokens=await getUsableTikTokTokens();
  const startedAt=new Date().toISOString();
  const running=queue.jobs.map((job)=>job.id===jobId?{...job,status:"publishing" as const,attempts:job.attempts+1,error:undefined,updatedAt:startedAt}:job);
  broadcastPublishQueue(await savePublishQueue(root,running));
  try{
    let publishId=target.externalPublishId;
    if(!publishId){
      const privacyLevel=item.publish?.tiktok?.privacyLevel;
      if(!privacyLevel) throw new Error("Review TikTok creator settings and choose a privacy level before publishing.");
      const creator=await queryTikTokCreatorInfo(tokens.access_token);
      if(!creator.privacyLevelOptions.includes(privacyLevel)) throw new Error("The selected TikTok privacy level is no longer available. Review creator settings again.");
      if(!item.outputPath) throw new Error("Rendered video path is missing.");
      validateTikTokMedia({...await probeMediaInfo(item.outputPath),maxDurationSec:creator.maxVideoPostDurationSec});
      const disclosure=item.publish?.tiktok;
      if(!disclosure?.musicUsageConfirmed) throw new Error("Confirm TikTok Music Usage Confirmation before publishing.");
      if(disclosure.commercialContent && !disclosure.brandOrganic && !disclosure.brandedContent) throw new Error("Choose Your Brand, Branded Content, or both for commercial TikTok content.");
      if(disclosure.brandedContent && privacyLevel==="SELF_ONLY") throw new Error("TikTok branded content cannot use private visibility.");
      const session=await initTikTokDirectPost({accessToken:tokens.access_token,item,privacyLevel,disableComment:disclosure.disableComment,disableDuet:disclosure.disableDuet,disableStitch:disclosure.disableStitch,isAigc:disclosure.isAigc,brandOrganic:disclosure.commercialContent && disclosure.brandOrganic,brandedContent:disclosure.commercialContent && disclosure.brandedContent});
      publishId=session.publish_id;
      const sessionJobs=running.map((job)=>job.id===jobId?{...job,externalPublishId:publishId,updatedAt:new Date().toISOString()}:job);
      broadcastPublishQueue(await savePublishQueue(root,sessionJobs));
      await uploadTikTokFile({uploadUrl:session.upload_url,filePath:item.outputPath,videoSize:session.videoSize,chunkSize:session.chunkSize,totalChunkCount:session.totalChunkCount});
    }
    let status;
    try { status=await waitForTikTokPublish({accessToken:tokens.access_token,publishId}); }
    catch(error){
      if(error instanceof Error && error.message.includes("still processing")){
        const current=await import("./tiktok-uploader").then((module)=>module.fetchTikTokPublishStatus(tokens.access_token,publishId));
        const latest=await loadPublishQueue(root);
        const processing=latest.jobs.map((job)=>job.id===jobId?{...job,status:"processing" as const,uploadedBytes:current.uploadedBytes,error:"TikTok is processing this post. It may take a few minutes or longer during moderation. Check status again instead of uploading a new copy.",updatedAt:new Date().toISOString()}:job);
        const saved=await savePublishQueue(root,processing);broadcastPublishQueue(saved);return saved;
      }
      throw error;
    }
    const externalId=status.postIds[0] ?? publishId;
    const result:import("../shared/content-factory").PublishResult={platform:"tiktok",status:"published",externalId,publishedAt:new Date().toISOString()};
    const latest=await loadPublishQueue(root);
    const completed=latest.jobs.map((job)=>job.id===jobId?{...job,status:"published" as const,result,error:undefined,updatedAt:new Date().toISOString()}:job);
    const saved=await savePublishQueue(root,completed);broadcastPublishQueue(saved);return saved;
  }catch(error){
    const message=error instanceof Error?error.message:String(error);
    const latest=await loadPublishQueue(root);
    const failed=latest.jobs.map((job)=>job.id===jobId?{...job,status:"failed" as const,error:message,updatedAt:new Date().toISOString()}:job);
    const saved=await savePublishQueue(root,failed);broadcastPublishQueue(saved);throw error;
  }
});

ipcMain.handle("content:publish-facebook-job", async (_event, jobId:string, item:import("../shared/content-factory").ContentBatchItem) => {
  const root=path.join(app.getPath("userData"),"publish"), queue=await loadPublishQueue(root);
  const target=queue.jobs.find((job)=>job.id===jobId && job.platform==="facebook");
  if(!target) throw new Error("Facebook publish job was not found.");
  if(target.status==="publishing") throw new Error("This Facebook upload is already in progress.");
  if(target.status==="published") throw new Error("This Facebook publish job is already complete.");
  if(target.scheduledAt && new Date(target.scheduledAt).getTime()>Date.now()) throw new Error("This publish job is scheduled for a future time.");
  if(!item.outputPath) throw new Error("Rendered video path is missing.");
  const pageId=item.publish?.meta?.pageId; if(!pageId) throw new Error("Choose a Facebook Page before publishing.");
  const token=await loadMetaToken(); if(!token) throw new Error("Connect Meta before publishing.");
  const pages=await listMetaPublishingPages(token.access_token), page=pages.find((entry)=>entry.id===pageId);
  if(!page) throw new Error("The selected Facebook Page is no longer available. Reconnect Meta and choose a Page again.");
  const running=queue.jobs.map((job)=>job.id===jobId?{...job,status:"publishing" as const,attempts:job.attempts+1,error:undefined,updatedAt:new Date().toISOString()}:job);
  broadcastPublishQueue(await savePublishQueue(root,running));
  try{
    const started=await createFacebookReel({pageId:page.id,pageAccessToken:page.accessToken});
    const sessionJobs=running.map((job)=>job.id===jobId?{...job,externalPublishId:started.video_id,updatedAt:new Date().toISOString()}:job);
    broadcastPublishQueue(await savePublishQueue(root,sessionJobs));
    const bytes=await readFile(item.outputPath);
    await uploadFacebookLocalReel({videoId:started.video_id,pageAccessToken:page.accessToken,bytes});
    const description=[item.publish?.description?.trim(),...(item.publish?.hashtags??[]).map((tag)=>`#${tag.replace(/^#/,"")}`)].filter(Boolean).join("\n\n");
    await finishFacebookReel({pageId:page.id,pageAccessToken:page.accessToken,videoId:started.video_id,title:item.publish?.title,description});
    const result:import("../shared/content-factory").PublishResult={platform:"facebook",status:"published",externalId:started.video_id,publishedAt:new Date().toISOString()};
    const latest=await loadPublishQueue(root), completed=latest.jobs.map((job)=>job.id===jobId?{...job,status:"published" as const,result,error:undefined,updatedAt:new Date().toISOString()}:job);
    const saved=await savePublishQueue(root,completed);broadcastPublishQueue(saved);return saved;
  }catch(error){
    const message=error instanceof Error?error.message:String(error), latest=await loadPublishQueue(root);
    const failed=latest.jobs.map((job)=>job.id===jobId?{...job,status:"failed" as const,error:message,updatedAt:new Date().toISOString()}:job);
    const saved=await savePublishQueue(root,failed);broadcastPublishQueue(saved);throw error;
  }
});

ipcMain.handle("content:publish-youtube-job", async (_event, jobId: string, item: import("../shared/content-factory").ContentBatchItem) => {
  const root = path.join(app.getPath("userData"), "publish");
  const queue = await loadPublishQueue(root);
  const target = queue.jobs.find((job) => job.id === jobId && job.platform === "youtube");
  if (!target) throw new Error("YouTube publish job was not found.");
  if (target.status === "publishing") throw new Error("This YouTube upload is already in progress.");
  if (target.status === "published") throw new Error("This YouTube publish job is already complete.");
  if (target.scheduledAt && new Date(target.scheduledAt).getTime() > Date.now()) throw new Error("This publish job is scheduled for a future time.");
  let tokens = await loadYouTubeTokens();
  if (!tokens) throw new Error("Connect YouTube before publishing.");
  if (tokens.expiresAt <= Date.now()) {
    const config = await loadYouTubeOAuthConfig();
    if (!config || !tokens.refresh_token) throw new Error("Reconnect YouTube to refresh authorization.");
    const refreshed = await refreshYouTubeAccessToken({ clientId:config.clientId, clientSecret:config.clientSecret, refreshToken:tokens.refresh_token });
    await saveYouTubeTokens(refreshed); tokens = await loadYouTubeTokens();
    if (!tokens) throw new Error("YouTube authorization refresh failed.");
  }
  const startedAt = new Date().toISOString();
  const running = queue.jobs.map((job) => job.id === jobId ? { ...job, status:"publishing" as const, attempts:job.attempts+1, error:undefined, updatedAt:startedAt } : job);
  const runningState=await savePublishQueue(root, running);
  broadcastPublishQueue(runningState);
  try {
    const result = await uploadVideoToYouTube({ accessToken:tokens.access_token, item, privacyStatus:"private" });
    const completed = running.map((job) => job.id === jobId ? { ...job, status:"published" as const, result, updatedAt:new Date().toISOString() } : job);
    const completedState=await savePublishQueue(root, completed);
    broadcastPublishQueue(completedState);
    return completedState;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failed = running.map((job) => job.id === jobId ? { ...job, status:"failed" as const, error:message, updatedAt:new Date().toISOString() } : job);
    const failedState=await savePublishQueue(root, failed); broadcastPublishQueue(failedState); throw error;
  }
});

ipcMain.handle("content:update-publish-plan", async (_event, batch: import("../shared/content-factory").ContentBatch, itemId:string, publish: import("../shared/content-factory").PublishPlan) => {
  const result = { ...batch, items: batch.items.map((item) => item.id === itemId ? { ...item, publish } : item), updatedAt:new Date().toISOString() };
  return saveBatchState(result);
});

ipcMain.handle("content:choose-batch-output", async () => {
  const result = await dialog.showOpenDialog({ title:"Choose folder for batch videos", properties:["openDirectory","createDirectory"] });
  return result.canceled ? null : result.filePaths[0] ?? null;
});

ipcMain.handle("content:render-batch", async (event, batch: import("../shared/content-factory").ContentBatch, outputDir:string) => {
  const workRoot=path.join(app.getPath("temp"),"gananajak-content-factory","batch-render");
  const rendered=await renderContentBatch(batch,outputDir,workRoot,(progress)=>{
    if(!event.sender.isDestroyed()) event.sender.send("content:batch-render-progress",progress);
    void saveBatchState({ ...batch, items: batch.items.map((existing) => existing.id === progress.item.id ? progress.item : existing), updatedAt:new Date().toISOString() });
  });
  const result = { ...rendered, items: rendered.items.map((item) => item.status === "rendered" ? ensurePublishPlan(item) : item), updatedAt:new Date().toISOString() };
  if(result.items.some(item=>item.status==="rendered")) await shell.openPath(outputDir);
  return saveBatchState(result);
});

ipcMain.handle("content:generate-batch-assets", async (event, batch: import("../shared/content-factory").ContentBatch) => {
  const rootDir = path.join(app.getPath("userData"), "content-assets");
  const result = await generateBatchAssets(batch, createDefaultAssetProviderRegistry(), rootDir, (progress) => {
    if (!event.sender.isDestroyed()) event.sender.send("content:batch-asset-progress", progress);
    void saveBatchState({ ...batch, items: batch.items.map((existing) => existing.id === progress.item.id ? progress.item : existing), updatedAt:new Date().toISOString() });
  });
  return saveBatchState(result);
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

let publishScheduler: ReturnType<typeof setInterval> | null = null;

async function refreshDuePublishJobs() {
  const root=path.join(app.getPath("userData"),"publish");
  const current=await loadPublishQueue(root);
  const jobs=releaseDuePublishJobs(current.jobs);
  const changed=jobs.some((job,index)=>job.status!==current.jobs[index]?.status);
  if (!changed) return;
  const saved=await savePublishQueue(root,jobs);
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send("content:publish-jobs-updated", saved);
  }
}

app.whenReady().then(async () => {
  if (process.argv.includes("--smoke-test")) {
    const smokeRoot = path.join(app.getPath("temp"), "gananajak-packaged-smoke");
    await mkdir(smokeRoot, { recursive: true });
    const imagePath = path.join(smokeRoot, "frame.png");
    await new Promise<void>((resolve, reject) => {
      const proc = spawn(ffmpegPath || "ffmpeg", ["-y", "-f", "lavfi", "-i", "color=c=0x182033:s=320x568:r=30", "-frames:v", "1", imagePath]);
      proc.once("error", reject);
      proc.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`Packaged FFmpeg smoke test failed (${code})`)));
    });
    await access(imagePath);
    app.exit(0);
    return;
  }
  installMediaProtocol();
  createWindow();
  await refreshDuePublishJobs();
  publishScheduler=setInterval(() => { void refreshDuePublishJobs(); }, 30_000);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("before-quit", () => { if (publishScheduler) clearInterval(publishScheduler); publishScheduler=null; });

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
