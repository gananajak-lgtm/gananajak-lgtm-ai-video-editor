import { contextBridge, ipcRenderer } from "electron";
import type { IpcRendererEvent } from "electron";
import type {
  DesktopApi,
  QcPackProgress,
  RenderProgress,
  TimelinePlan
} from "../shared/types";

const api: DesktopApi = {
  checkProviderConnection: (provider) => ipcRenderer.invoke("ai:check-provider-connection", provider),
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
  saveReplicateVideoModel: (model) => ipcRenderer.invoke("content:save-replicate-video-model", model),
  saveElevenLabsApiKey: (apiKey) => ipcRenderer.invoke("content:save-elevenlabs-key", apiKey),
  listElevenLabsWorkspaces: () => ipcRenderer.invoke("voice:workspaces"),
  addElevenLabsWorkspace: (name, key) => ipcRenderer.invoke("voice:add-workspace", name, key),
  selectElevenLabsWorkspace: (id) => ipcRenderer.invoke("voice:select-workspace", id),
  getElevenLabsSubscription: () => ipcRenderer.invoke("voice:subscription"),
  listElevenLabsVoices: () => ipcRenderer.invoke("voice:list-elevenlabs-voices"),
  generateContentProject: (brief) =>
    ipcRenderer.invoke("content:generate-project", brief),
  generateLocalTestProject: (brief) =>
    ipcRenderer.invoke("content:generate-local-test-project", brief),
  generateLocalTestAssets: (project) =>
    ipcRenderer.invoke("content:generate-local-test-assets", project),
  prepareContentBatch: (briefs) =>
    ipcRenderer.invoke("content:prepare-batch", briefs),
  createLocalTestBatch: (briefs, outputDir) =>
    ipcRenderer.invoke("content:create-local-test-batch", briefs, outputDir),
  resumeLocalTestBatch: (batch, outputDir) =>
    ipcRenderer.invoke("content:resume-local-test-batch", batch, outputDir),
  loadContentBatch: () => ipcRenderer.invoke("content:load-batch"),
  updatePublishPlan: (batch, itemId, publish) => ipcRenderer.invoke("content:update-publish-plan", batch, itemId, publish),
  validatePublishItem: (item) => ipcRenderer.invoke("content:validate-publish-item", item),
  loadPublishJobs: () => ipcRenderer.invoke("content:load-publish-jobs"),
  createPublishJobs: (item) => ipcRenderer.invoke("content:create-publish-jobs", item),
  publishYouTubeJob: (jobId, item) => ipcRenderer.invoke("content:publish-youtube-job", jobId, item),
  getTikTokCreatorInfo: () => ipcRenderer.invoke("content:get-tiktok-creator-info"),
  publishTikTokJob: (jobId, item) => ipcRenderer.invoke("content:publish-tiktok-job", jobId, item),
  publishFacebookJob: (jobId, item) => ipcRenderer.invoke("content:publish-facebook-job", jobId, item),
  publishInstagramJob: (jobId, item) => ipcRenderer.invoke("content:publish-instagram-job", jobId, item),
  configureInstagramHosting: (uploadUrl, publicBaseUrl, bearerToken) => ipcRenderer.invoke("content:configure-instagram-hosting", uploadUrl, publicBaseUrl, bearerToken),
  stageInstagramVideo: (item) => ipcRenderer.invoke("content:stage-instagram-video", item),
  getPublishAccounts: () => ipcRenderer.invoke("content:get-publish-accounts"),
  configureYouTubeOAuth: (clientId, clientSecret) => ipcRenderer.invoke("content:configure-youtube-oauth", clientId, clientSecret),
  configureTikTokOAuth: (clientKey, clientSecret) => ipcRenderer.invoke("content:configure-tiktok-oauth", clientKey, clientSecret),
  connectYouTube: () => ipcRenderer.invoke("content:connect-youtube"),
  connectTikTok: () => ipcRenderer.invoke("content:connect-tiktok"),
  configureMetaOAuth: (appId, appSecret, redirectUri) => ipcRenderer.invoke("content:configure-meta-oauth", appId, appSecret, redirectUri),
  configureMetaBroker: (baseUrl, clientId) => ipcRenderer.invoke("content:configure-meta-broker", baseUrl, clientId),
  startMetaBrokerAuth: () => ipcRenderer.invoke("content:start-meta-broker-auth"),
  connectMeta: () => ipcRenderer.invoke("content:connect-meta"),
  getMetaDestinations: () => ipcRenderer.invoke("content:get-meta-destinations"),
  importAffiliateProduct: (sourceUrl) => ipcRenderer.invoke("affiliate:import-product", sourceUrl),
  captureAffiliateProductFromBrowser: (product) => ipcRenderer.invoke("affiliate:capture-browser-product", product),
  selectAffiliateProductPhotos: (product) => ipcRenderer.invoke("affiliate:select-product-photos", product),
  configureTikTokShopApp: (appKey,appSecret) => ipcRenderer.invoke("affiliate:configure-tiktok-shop",appKey,appSecret),
  completeTikTokShopCreatorAuth: (authCode) => ipcRenderer.invoke("affiliate:complete-tiktok-shop-auth",authCode),
  connectTikTokShopCreator: () => ipcRenderer.invoke("affiliate:connect-tiktok-shop"),
  getTikTokShopCreatorStatus: () => ipcRenderer.invoke("affiliate:tiktok-shop-status"),
  explainAffiliateProduct: (product,query) => ipcRenderer.invoke("affiliate:explain-product",product,query),
  searchAffiliateProducts: (query) => ipcRenderer.invoke("affiliate:search-products", query),
  loadAffiliateQueue: () => ipcRenderer.invoke("affiliate:load-queue"),
  getAffiliateAccessGuide: (platform) => ipcRenderer.invoke("affiliate:access-guide",platform),
  saveAffiliateQueue: (products, jobs) => ipcRenderer.invoke("affiliate:save-queue", products, jobs),
  createAffiliateJobs: (products) => ipcRenderer.invoke("affiliate:create-jobs", products),
  getAffiliatePublishReadiness: (item,job) => ipcRenderer.invoke("affiliate:publish-readiness",item,job),
  createAffiliatePublishJobs: (item,job) => ipcRenderer.invoke("affiliate:create-publish-jobs",item,job),
  prepareAffiliateBatch: (jobs, language, duration) => ipcRenderer.invoke("affiliate:prepare-batch", jobs, language, duration),
  createLocalAffiliateBatch: (jobs, outputDir, language, duration) => ipcRenderer.invoke("affiliate:create-local-batch", jobs, outputDir, language, duration),
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
  onPublishJobsUpdated: (listener) => { const handler = (_event: IpcRendererEvent, state: Parameters<typeof listener>[0]) => listener(state); ipcRenderer.on("content:publish-jobs-updated", handler); return () => ipcRenderer.removeListener("content:publish-jobs-updated", handler); },
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
