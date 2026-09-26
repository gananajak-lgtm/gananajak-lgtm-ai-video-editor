import { useEffect, useState } from "react";
import type {
  ContentBatch,
  ContentFormat,
  ContentLanguage,
  ContentProject,
  PublishPlatform,
  PublishPlan,
  PublishAccount,
  PublishJob
} from "../shared/content-factory";
import type { ContentProviderStatus } from "../shared/types";
import type { AffiliateContentJob, AffiliateProduct } from "../shared/affiliate-factory";

type Props = {
  aiConfigured: boolean;
  project: ContentProject | null;
  onGenerated: (project: ContentProject) => void;
};

export default function ContentFactoryPanel({
  aiConfigured,
  project,
  onGenerated
}: Props) {
  const [topic, setTopic] = useState("");
  const [format, setFormat] = useState<ContentFormat>("short");
  const [language, setLanguage] = useState<ContentLanguage>("th");
  const [duration, setDuration] = useState(60);
  const [generationMode, setGenerationMode] = useState<"cloud" | "local-test">("cloud");
  const [generating, setGenerating] = useState(false);
  const [batchTopics, setBatchTopics] = useState("");
  const [batch, setBatch] = useState<ContentBatch | null>(null);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ completed:0, total:0 });
  const [batchAssetsRunning, setBatchAssetsRunning] = useState(false);
  const [batchAssetProgress, setBatchAssetProgress] = useState({ completed:0, total:0, assetCompleted:0, assetTotal:0 });
  const [batchRendering, setBatchRendering] = useState(false);
  const [batchOneClickRunning, setBatchOneClickRunning] = useState(false);
  const [batchRenderProgress, setBatchRenderProgress] = useState({ completed:0, total:0, renderProgress:0 });
  const [error, setError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [pipelineStage, setPipelineStage] = useState<"idle" | "assets" | "render" | "ready">("idle");
  const [providerStatus, setProviderStatus] = useState<ContentProviderStatus>({ replicateConfigured:false, elevenLabsConfigured:false });
  const [replicateToken, setReplicateToken] = useState("");
  const [elevenLabsKey, setElevenLabsKey] = useState("");
  const [publishAccounts, setPublishAccounts] = useState<PublishAccount[]>([]);
  const [youtubeClientId, setYoutubeClientId] = useState("");
  const [youtubeClientSecret, setYoutubeClientSecret] = useState("");
  const [youtubeConnecting, setYoutubeConnecting] = useState(false);
  const [publishValidation, setPublishValidation] = useState<Record<string, { valid:boolean; issues:Array<{ field:string; message:string; platform?:PublishPlatform }> }>>({});
  const [publishJobs, setPublishJobs] = useState<PublishJob[]>([]);
  const [publishDrafts, setPublishDrafts] = useState<Record<string, PublishPlan>>({});
  const [publishSaving, setPublishSaving] = useState<string | null>(null);
  const [affiliateUrls, setAffiliateUrls] = useState("");
  const [affiliateProducts, setAffiliateProducts] = useState<AffiliateProduct[]>([]);
  const [affiliateJobs, setAffiliateJobs] = useState<AffiliateContentJob[]>([]);
  const [affiliateImporting, setAffiliateImporting] = useState(false);
  const [affiliateLocalRunning, setAffiliateLocalRunning] = useState(false);
  const [affiliateImportErrors, setAffiliateImportErrors] = useState<string[]>([]);

  useEffect(() => {
    void window.videoEditor.getContentProviderStatus().then(setProviderStatus);
    void window.videoEditor.loadContentBatch().then((saved) => { if (saved) setBatch(saved); });
    void window.videoEditor.getPublishAccounts().then(setPublishAccounts);
    void window.videoEditor.loadPublishJobs().then((saved) => setPublishJobs(saved.jobs));
    void window.videoEditor.loadAffiliateQueue().then((saved) => { setAffiliateProducts(saved.products); setAffiliateJobs(saved.jobs); });
  }, []);

  const getPublishDraft = (item: import("../shared/content-factory").ContentBatchItem): PublishPlan =>
    publishDrafts[item.id] ?? item.publish ?? { status:"draft" };

  const patchPublishDraft = (item: import("../shared/content-factory").ContentBatchItem, patch: Partial<PublishPlan>) => {
    const current = getPublishDraft(item);
    setPublishDrafts((drafts) => ({ ...drafts, [item.id]: { ...current, ...patch } }));
    setPublishValidation((currentValidation) => { const next={...currentValidation}; delete next[item.id]; return next; });
  };

  const savePublishDraft = async (itemId: string) => {
    if (!batch || publishSaving) return;
    const item=batch.items.find((entry)=>entry.id===itemId); if(!item) return;
    const publish=getPublishDraft(item);
    setPublishSaving(itemId); setError(null);
    try {
      const next=await window.videoEditor.updatePublishPlan(batch,itemId,publish); setBatch(next);
      setPublishDrafts((drafts)=>{const copy={...drafts};delete copy[itemId];return copy;});
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : String(saveError)); }
    finally { setPublishSaving(null); }
  };

  const validatePublish = async (itemId:string) => {
    const item=batch?.items.find((entry)=>entry.id===itemId);
    if(!item) return;
    const result=await window.videoEditor.validatePublishItem(item);
    setPublishValidation((current)=>({...current,[itemId]:result}));
  };

  const queuePublish = async (itemId: string) => {
    const item = batch?.items.find((entry) => entry.id === itemId);
    if (!item) return;
    setError(null);
    try {
      const saved = await window.videoEditor.createPublishJobs(item);
      setPublishJobs(saved.jobs);
      setPublishValidation((current) => ({ ...current, [itemId]: { valid:true, issues:[] } }));
    } catch (queueError) { setError(queueError instanceof Error ? queueError.message : String(queueError)); }
  };

  const publishYouTubeJob = async (jobId: string, itemId: string) => {
    const item = batch?.items.find((entry) => entry.id === itemId);
    if (!item || youtubeConnecting) return;
    setError(null);
    try {
      const saved = await window.videoEditor.publishYouTubeJob(jobId, item);
      setPublishJobs(saved.jobs);
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : String(publishError));
      const saved = await window.videoEditor.loadPublishJobs(); setPublishJobs(saved.jobs);
    }
  };

  const togglePublishPlatform = (item: import("../shared/content-factory").ContentBatchItem, platform:PublishPlatform) => {
    const current=getPublishDraft(item).platforms ?? [];
    patchPublishDraft(item,{platforms:current.includes(platform)?current.filter((value)=>value!==platform):[...current,platform]});
  };

  const saveYouTubeOAuth = async () => {
    if (!youtubeClientId.trim()) return;
    setError(null);
    try {
      setPublishAccounts(await window.videoEditor.configureYouTubeOAuth(youtubeClientId.trim(), youtubeClientSecret.trim() || undefined));
      setYoutubeClientSecret("");
    } catch (oauthError) { setError(oauthError instanceof Error ? oauthError.message : String(oauthError)); }
  };

  const connectYouTube = async () => {
    if (youtubeConnecting) return;
    setYoutubeConnecting(true); setError(null);
    try { setPublishAccounts(await window.videoEditor.connectYouTube()); }
    catch (oauthError) { setError(oauthError instanceof Error ? oauthError.message : String(oauthError)); }
    finally { setYoutubeConnecting(false); }
  };

  const importAffiliateProducts = async () => {
    const urls = affiliateUrls.split(/\r?\n/).map((value) => value.trim()).filter(Boolean).slice(0, 100);
    if (!urls.length || affiliateImporting) return;
    setAffiliateImporting(true); setError(null); setAffiliateImportErrors([]);
    try {
      const products: AffiliateProduct[] = []; const failures: string[] = [];
      for (const url of urls) {
        try { products.push(await window.videoEditor.importAffiliateProduct(url)); }
        catch (importError) { failures.push(`${url}: ${importError instanceof Error ? importError.message : String(importError)}`); }
      }
      const jobs = await window.videoEditor.createAffiliateJobs(products);
      setAffiliateProducts(products); setAffiliateJobs(jobs); setAffiliateImportErrors(failures);
      await window.videoEditor.saveAffiliateQueue(products, jobs);
      if (!products.length && failures.length) setError("No valid affiliate products were imported.");
    } catch (importError) { setError(importError instanceof Error ? importError.message : String(importError)); }
    finally { setAffiliateImporting(false); }
  };

  const createLocalAffiliateVideos = async () => {
    if (!affiliateJobs.length || affiliateLocalRunning) return;
    const outputDir = await window.videoEditor.chooseBatchOutputFolder(); if (!outputDir) return;
    setAffiliateLocalRunning(true); setError(null); setBatchProgress({ completed:0, total:affiliateJobs.length });
    const unsubscribe = window.videoEditor.onContentBatchProgress((progress) => setBatchProgress({ completed:progress.completed, total:progress.total }));
    try { setBatch(await window.videoEditor.createLocalAffiliateBatch(affiliateJobs, outputDir, language, Math.max(10, duration))); }
    catch (localError) { setError(localError instanceof Error ? localError.message : String(localError)); }
    finally { unsubscribe(); setAffiliateLocalRunning(false); }
  };

  const saveProviderKeys = async () => {
    let status = providerStatus;
    if (replicateToken.trim()) status = await window.videoEditor.saveReplicateApiToken(replicateToken);
    if (elevenLabsKey.trim()) status = await window.videoEditor.saveElevenLabsApiKey(elevenLabsKey);
    setProviderStatus(status); setReplicateToken(""); setElevenLabsKey("");
  };
  const [assetProgress, setAssetProgress] = useState({ completed:0, total:0, kind:undefined as string | undefined });
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderedPath, setRenderedPath] = useState<string | null>(null);
  const [oneClickRunning, setOneClickRunning] = useState(false);
  const [copiedSceneId, setCopiedSceneId] = useState<string | null>(null);

  const generate = async () => {
    if (!topic.trim() || (generationMode === "cloud" && !aiConfigured)) return;

    setGenerating(true);
    setError(null);

    try {
      const generator = generationMode === "local-test" ? window.videoEditor.generateLocalTestProject : window.videoEditor.generateContentProject;
      const result = await generator({
        topic: topic.trim(),
        format,
        language,
        targetDurationSeconds: Math.max(10, duration),
        tone: "cinematic documentary",
        audience: "general online video audience"
      });

      onGenerated(result);
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : String(generateError)
      );
    } finally {
      setGenerating(false);
    }
  };

  const createLocalTestVideo = async () => {
    if (!topic.trim() || oneClickRunning) return;
    const outputPath = await window.videoEditor.chooseOutput();
    if (!outputPath) return;
    setOneClickRunning(true); setGenerating(true); setRendering(true); setError(null); setRenderedPath(null); setRenderProgress(0); setPipelineStage("assets");
    const unsubscribeRender = window.videoEditor.onRenderProgress((progress) => setRenderProgress(Math.max(0, Math.min(1, progress.progress))));
    try {
      const planned = await window.videoEditor.generateLocalTestProject({ topic:topic.trim(), format, language, targetDurationSeconds:Math.max(10,duration), tone:"local pipeline test", audience:"test" });
      onGenerated(planned);
      const prepared = await window.videoEditor.generateLocalTestAssets(planned);
      onGenerated(prepared);
      setPipelineStage("render");
      const result = await window.videoEditor.assembleAndRenderContent(prepared, outputPath);
      setRenderedPath(result.outputPath); setRenderProgress(1); setPipelineStage("ready");
    } catch (createError) { setError(createError instanceof Error ? createError.message : String(createError)); setPipelineStage("idle"); }
    finally { unsubscribeRender(); setGenerating(false); setRendering(false); setOneClickRunning(false); }
  };

  const createVideoOneClick = async () => {
    if (!topic.trim() || !aiConfigured || oneClickRunning) return;
    if (!providerStatus.replicateConfigured || !providerStatus.elevenLabsConfigured) {
      setError("Configure both Replicate and ElevenLabs before creating a video.");
      return;
    }
    const outputPath = await window.videoEditor.chooseOutput();
    if (!outputPath) return;
    setOneClickRunning(true); setGenerating(true); setRendering(true); setError(null); setRenderedPath(null); setRenderProgress(0); setPipelineStage("assets");
    const unsubscribeAssets = window.videoEditor.onContentAssetProgress((progress) => setAssetProgress({ completed:progress.completed, total:progress.total, kind:progress.kind }));
    const unsubscribeRender = window.videoEditor.onRenderProgress((progress) => setRenderProgress(Math.max(0, Math.min(1, progress.progress))));
    try {
      const planned = await window.videoEditor.generateContentProject({ topic:topic.trim(), format, language, targetDurationSeconds:Math.max(10,duration), tone:"cinematic documentary", audience:"general online video audience" });
      onGenerated(planned);
      const prepared = await window.videoEditor.generateContentAssets(planned);
      onGenerated(prepared);
      setPipelineStage("render");
      const result = await window.videoEditor.assembleAndRenderContent(prepared, outputPath);
      setRenderedPath(result.outputPath); setRenderProgress(1); setPipelineStage("ready");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : String(createError)); setPipelineStage("idle");
    } finally {
      unsubscribeAssets(); unsubscribeRender(); setGenerating(false); setRendering(false); setOneClickRunning(false);
    }
  };

  const generateBatch = async () => {
    const topics = batchTopics.split(/\r?\n/).map((value) => value.trim()).filter(Boolean).slice(0, 50);
    if (!aiConfigured || topics.length === 0) return;
    setBatchGenerating(true);
    setBatchProgress({ completed:0, total:topics.length });
    setError(null);
    const unsubscribeBatch = window.videoEditor.onContentBatchProgress((progress) => {
      setBatchProgress({ completed:progress.completed, total:progress.total });
      setBatch((current) => current ? { ...current, items:current.items.map((item) => item.id === progress.item.id ? progress.item : item) } : current);
    });
    try {
      const result = await window.videoEditor.prepareContentBatch(topics.map((batchTopic) => ({
        topic: batchTopic,
        format,
        language,
        targetDurationSeconds: Math.max(10, duration),
        tone: "cinematic documentary",
        audience: "general online video audience"
      })));
      setBatch(result);
    } catch (batchError) {
      setError(batchError instanceof Error ? batchError.message : String(batchError));
    } finally {
      unsubscribeBatch();
      setBatchGenerating(false);
    }
  };

  const createLocalTestBatch = async () => {
    const topics = batchTopics.split(/\\r?\\n/).map((value) => value.trim()).filter(Boolean).slice(0, 50);
    if (topics.length === 0 || batchOneClickRunning) return;
    const outputDir = await window.videoEditor.chooseBatchOutputFolder();
    if (!outputDir) return;
    setBatchOneClickRunning(true); setError(null); setBatchProgress({completed:0,total:topics.length});
    const unsubscribe = window.videoEditor.onContentBatchProgress((progress) => { setBatchProgress({completed:progress.completed,total:progress.total}); setBatch((current)=>current?{...current,items:current.items.map((item)=>item.id===progress.item.id?progress.item:item)}:current); });
    try {
      const briefs = topics.map((batchTopic) => ({topic:batchTopic,format,language,targetDurationSeconds:Math.max(10,duration),tone:"local pipeline test",audience:"test"}));
      setBatch(await window.videoEditor.createLocalTestBatch(briefs, outputDir));
    } catch (batchError) { setError(batchError instanceof Error ? batchError.message : String(batchError)); }
    finally { unsubscribe(); setBatchOneClickRunning(false); }
  };

  const resumeLocalTestBatch = async () => {
    if (!batch || batchOneClickRunning || !batch.items.some((item) => item.status !== "rendered")) return;
    const outputDir = await window.videoEditor.chooseBatchOutputFolder();
    if (!outputDir) return;
    setBatchOneClickRunning(true); setError(null);
    const unsubscribe = window.videoEditor.onContentBatchProgress((progress) => {
      setBatchProgress({completed:progress.completed,total:progress.total});
      setBatch((current)=>current?{...current,items:current.items.map((item)=>item.id===progress.item.id?progress.item:item)}:current);
    });
    try { setBatch(await window.videoEditor.resumeLocalTestBatch(batch, outputDir)); }
    catch (resumeError) { setError(resumeError instanceof Error ? resumeError.message : String(resumeError)); }
    finally { unsubscribe(); setBatchOneClickRunning(false); }
  };

  const createBatchVideosOneClick = async () => {
    const topics = batchTopics.split(/\\r?\\n/).map((value) => value.trim()).filter(Boolean).slice(0, 50);
    if (!aiConfigured || topics.length === 0 || batchOneClickRunning) return;
    if (!providerStatus.replicateConfigured || !providerStatus.elevenLabsConfigured) {
      setError("Configure both Replicate and ElevenLabs before creating batch videos."); return;
    }
    const outputDir = await window.videoEditor.chooseBatchOutputFolder();
    if (!outputDir) return;
    setBatchOneClickRunning(true); setError(null);
    const unsubscribePlan = window.videoEditor.onContentBatchProgress((progress) => { setBatchProgress({completed:progress.completed,total:progress.total}); setBatch((current)=>current?{...current,items:current.items.map((item)=>item.id===progress.item.id?progress.item:item)}:current); });
    const unsubscribeAssets = window.videoEditor.onContentBatchAssetProgress((progress) => { setBatchAssetProgress({completed:progress.completed,total:progress.total,assetCompleted:progress.assetCompleted??0,assetTotal:progress.assetTotal??0}); setBatch((current)=>current?{...current,items:current.items.map((item)=>item.id===progress.item.id?progress.item:item)}:current); });
    const unsubscribeRender = window.videoEditor.onContentBatchRenderProgress((progress) => { setBatchRenderProgress({completed:progress.completed,total:progress.total,renderProgress:progress.renderProgress??0}); setBatch((current)=>current?{...current,items:current.items.map((item)=>item.id===progress.item.id?progress.item:item)}:current); });
    try {
      const briefs = topics.map((batchTopic) => ({topic:batchTopic,format,language,targetDurationSeconds:Math.max(10,duration),tone:"cinematic documentary",audience:"general online video audience"}));
      let current = await window.videoEditor.prepareContentBatch(briefs); setBatch(current);
      current = await window.videoEditor.generateContentBatchAssets(current); setBatch(current);
      current = await window.videoEditor.renderContentBatch(current, outputDir); setBatch(current);
    } catch (batchError) { setError(batchError instanceof Error ? batchError.message : String(batchError)); }
    finally { unsubscribePlan(); unsubscribeAssets(); unsubscribeRender(); setBatchOneClickRunning(false); }
  };

  const resumeBatchOneClick = async () => {
    if (!batch || batchOneClickRunning) return;
    if (!providerStatus.replicateConfigured || !providerStatus.elevenLabsConfigured) { setError("Configure both Replicate and ElevenLabs before resuming batch videos."); return; }
    const needsRender = batch.items.some((item) => item.status === "assets-ready" || (item.status === "failed" && item.failedStage === "render"));
    const outputDir = needsRender ? await window.videoEditor.chooseBatchOutputFolder() : null;
    if (needsRender && !outputDir) return;
    setBatchOneClickRunning(true); setError(null);
    try {
      let current = batch;
      if (current.items.some((item) => item.status === "queued" || (item.status === "failed" && item.failedStage === "project"))) {
        current = await window.videoEditor.resumeContentBatch(current); setBatch(current);
      }
      if (current.items.some((item) => item.status === "ready" || (item.status === "failed" && item.failedStage === "assets"))) {
        current = await window.videoEditor.generateContentBatchAssets(current); setBatch(current);
      }
      if (current.items.some((item) => item.status === "assets-ready" || (item.status === "failed" && item.failedStage === "render"))) {
        const dir = outputDir ?? await window.videoEditor.chooseBatchOutputFolder();
        if (dir) { current = await window.videoEditor.renderContentBatch(current, dir); setBatch(current); }
      }
    } catch (resumeError) { setError(resumeError instanceof Error ? resumeError.message : String(resumeError)); }
    finally { setBatchOneClickRunning(false); }
  };

  const retryFailedBatch = async () => {
    if (!batch || batchGenerating || !batch.items.some((item) => item.status === "failed" && item.failedStage === "project")) return;
    setBatchGenerating(true);
    setBatchProgress({ completed:batch.items.filter((item) => item.status !== "failed" || item.failedStage !== "project").length, total:batch.items.length });
    setError(null);
    const unsubscribeBatch = window.videoEditor.onContentBatchProgress((progress) => {
      setBatchProgress({ completed:progress.completed, total:progress.total });
      setBatch((current) => current ? { ...current, items:current.items.map((item) => item.id === progress.item.id ? progress.item : item) } : current);
    });
    try {
      setBatch(await window.videoEditor.resumeContentBatch(batch));
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : String(retryError));
    } finally {
      unsubscribeBatch();
      setBatchGenerating(false);
    }
  };

  const generateBatchAssets = async () => {
    if (!batch || batchAssetsRunning || !providerStatus.replicateConfigured || !providerStatus.elevenLabsConfigured) return;
    setBatchAssetsRunning(true);
    setError(null);
    const unsubscribe = window.videoEditor.onContentBatchAssetProgress((progress) => {
      setBatchAssetProgress({ completed:progress.completed, total:progress.total, assetCompleted:progress.assetCompleted ?? 0, assetTotal:progress.assetTotal ?? 0 });
      setBatch((current) => current ? { ...current, items:current.items.map((item) => item.id === progress.item.id ? progress.item : item) } : current);
    });
    try {
      setBatch(await window.videoEditor.generateContentBatchAssets(batch));
    } catch (assetError) {
      setError(assetError instanceof Error ? assetError.message : String(assetError));
    } finally {
      unsubscribe();
      setBatchAssetsRunning(false);
    }
  };

  const renderBatch = async () => {
    if (!batch || batchRendering || !batch.items.some((item) => item.status === "assets-ready" || (item.status === "failed" && item.failedStage === "render"))) return;
    const outputDir = await window.videoEditor.chooseBatchOutputFolder();
    if (!outputDir) return;
    setBatchRendering(true); setError(null);
    const unsubscribe = window.videoEditor.onContentBatchRenderProgress((progress) => {
      setBatchRenderProgress({ completed:progress.completed, total:progress.total, renderProgress:progress.renderProgress ?? 0 });
      setBatch((current) => current ? { ...current, items:current.items.map((item) => item.id === progress.item.id ? progress.item : item) } : current);
    });
    try { setBatch(await window.videoEditor.renderContentBatch(batch, outputDir)); }
    catch (renderBatchError) { setError(renderBatchError instanceof Error ? renderBatchError.message : String(renderBatchError)); }
    finally { unsubscribe(); setBatchRendering(false); }
  };

  const generateAndRender = async () => {
    if (!project) return;
    if (!providerStatus.replicateConfigured || !providerStatus.elevenLabsConfigured) {
      setError("Configure both Replicate and ElevenLabs before generating assets.");
      return;
    }
    setRendering(true);
    setPipelineStage("assets");
    setRenderProgress(0);
    setAssetProgress({ completed:0, total:0, kind:undefined });
    setRenderedPath(null);
    setError(null);
    const unsubscribeAssets = window.videoEditor.onContentAssetProgress((progress) => {
      setAssetProgress({ completed:progress.completed, total:progress.total, kind:progress.kind });
    });
    const unsubscribe = window.videoEditor.onRenderProgress((progress) => {
      setRenderProgress(Math.max(0, Math.min(1, progress.progress)));
    });
    try {
      const outputPath = await window.videoEditor.chooseOutput();
      if (!outputPath) return;
      const prepared = await window.videoEditor.generateContentAssets(project);
      onGenerated(prepared);
      setPipelineStage("render");
      const result = await window.videoEditor.assembleAndRenderContent(prepared, outputPath);
      setRenderedPath(result.outputPath);
      setRenderProgress(1);
      setPipelineStage("ready");
    } catch (renderError) {
      setError(renderError instanceof Error ? renderError.message : String(renderError));
      setPipelineStage("idle");
    } finally {
      unsubscribeAssets();
      unsubscribe();
      setRendering(false);
    }
  };

  const importMetaVideoForScene = async (sceneId: string) => {
    if (!project) return;
    setError(null);
    try {
      const updated = await window.videoEditor.importMetaVideo(project, sceneId);
      if (updated) onGenerated(updated);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : String(importError));
    }
  };

  const copyVideoPrompt = async (sceneId: string, prompt?: string) => {
    if (!prompt) return;
    await navigator.clipboard.writeText(prompt);
    setCopiedSceneId(sceneId);
    window.setTimeout(() => setCopiedSceneId((current) => current === sceneId ? null : current), 1500);
  };

  return (
    <section className="aiPanel">
      <div className="aiPanelHeader">
        <div>
          <p className="eyebrow">AI CONTENT FACTORY</p>
          <h3>Start with a topic, not a timeline</h3>
          <p className="muted">
            Generate a complete narration script plus production-ready scenes,
            image prompts, video prompts, timing, and sound-effect hints.
          </p>
        </div>
        <span className={generationMode === "local-test" || aiConfigured ? "aiBadge readyBadge" : "aiBadge"}>
          {generationMode === "local-test" ? "Local Test · 0 API calls" : aiConfigured ? "Generator ready" : "API key required"}
        </span>
      </div>

      {generationMode === "local-test" && (
        <div className="transcriptRow" role="note">
          <span>LOCAL</span>
          <div>
            <strong>Safe pipeline test · zero external API calls</strong>
            <p className="muted">Creates dark placeholder images and silent narration audio with bundled FFmpeg. Use this to verify Topic → scenes → assets → MP4 before spending cloud credits.</p>
          </div>
        </div>
      )}

      <div className="keyRow">
        <input
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          placeholder="Topic, e.g. Island of the Dolls"
        />
        <select value={generationMode} onChange={(event) => setGenerationMode(event.target.value as "cloud" | "local-test")} aria-label="Generation mode">
          <option value="cloud">Cloud Quality</option>
          <option value="local-test">Local Test · No API cost</option>
        </select>
        <select
          value={format}
          onChange={(event) => setFormat(event.target.value as ContentFormat)}
        >
          <option value="short">Short</option>
          <option value="episode">Episode</option>
        </select>
        <select
          value={language}
          onChange={(event) => setLanguage(event.target.value as ContentLanguage)}
        >
          <option value="th">Thai</option>
          <option value="en">English</option>
        </select>
        <input
          type="number"
          min={10}
          max={7200}
          value={duration}
          onChange={(event) => setDuration(Number(event.target.value) || 60)}
          aria-label="Target duration in seconds"
        />
        <button
          className="primary"
          disabled={(generationMode === "cloud" && !aiConfigured) || !topic.trim() || generating}
          onClick={generate}
        >
          {generating ? "Planning video..." : generationMode === "local-test" ? "Create Local Test Project" : "Create script + scenes"}
        </button>
        {generationMode === "local-test" ? (
          <button className="primary" disabled={!topic.trim() || oneClickRunning} onClick={createLocalTestVideo}>
            {oneClickRunning ? (pipelineStage === "render" ? `Rendering Local Test ${Math.round(renderProgress * 100)}%...` : "Building Local Test...") : "Create Local Test MP4 (0 API)"}
          </button>
        ) : (
          <button className="primary" disabled={!aiConfigured || !topic.trim() || oneClickRunning || !providerStatus.replicateConfigured || !providerStatus.elevenLabsConfigured} onClick={createVideoOneClick}>
            {oneClickRunning ? (pipelineStage === "render" ? `Rendering ${Math.round(renderProgress * 100)}%...` : "Creating video...") : "Create Video (One Click)"}
          </button>
        )}
      </div>


      <div className="transcriptPanel">
        <div className="timelineHeader">
          <div>
            <p className="eyebrow">BATCH VIDEO FACTORY</p>
            <h3>Create many projects from a topic list</h3>
            <p className="muted">One topic per line. The current format, language, and duration settings apply to every item.</p>
          </div>
          <span className="aiBadge">{batchTopics.split(/\\r?\\n/).filter((value) => value.trim()).length} topics</span>
        </div>
        <textarea value={batchTopics} onChange={(event) => setBatchTopics(event.target.value)} placeholder={"Island of the Dolls\\nAokigahara Forest\\nMary Celeste"} rows={6} />
        <div className="keyRow">
          {generationMode === "local-test" ? (
            <button className="primary" disabled={!batchTopics.trim() || batchOneClickRunning} onClick={createLocalTestBatch}>{batchOneClickRunning ? `Creating Local Batch ${batchProgress.completed}/${batchProgress.total}...` : "Create Local Batch MP4s (0 API)"}</button>
          ) : (
            <button className="primary" disabled={!aiConfigured || !batchTopics.trim() || batchOneClickRunning || !providerStatus.replicateConfigured || !providerStatus.elevenLabsConfigured} onClick={createBatchVideosOneClick}>{batchOneClickRunning ? "Creating batch videos..." : "Create Batch Videos (One Click)"}</button>
          )}
          {generationMode === "cloud" && (
            <>
              <button className="primary" disabled={!aiConfigured || !batchTopics.trim() || batchGenerating || batchOneClickRunning} onClick={generateBatch}>
                {batchGenerating ? `Preparing ${batchProgress.completed}/${batchProgress.total}...` : "Create batch projects"}
              </button>
              {batchGenerating && <progress max={Math.max(1, batchProgress.total)} value={batchProgress.completed} aria-label="Batch project progress" />}
              {batch && batch.items.some((item) => item.status !== "rendered") && <button className="primary" disabled={batchGenerating || batchAssetsRunning || batchRendering || batchOneClickRunning} onClick={resumeBatchOneClick}>{batchOneClickRunning ? "Resuming remaining videos..." : "Resume Remaining (One Click)"}</button>}
              {batch?.items.some((item) => item.status === "failed" && item.failedStage === "project") && <button disabled={batchGenerating || batchAssetsRunning || batchRendering} onClick={retryFailedBatch}>Retry planning failures</button>}
              {batch?.items.some((item) => item.status === "failed" && item.failedStage === "assets") && <button disabled={batchGenerating || batchAssetsRunning || batchRendering} onClick={generateBatchAssets}>Retry asset failures</button>}
              {batch?.items.some((item) => item.status === "failed" && item.failedStage === "render") && <button disabled={batchGenerating || batchAssetsRunning || batchRendering} onClick={renderBatch}>Retry render failures</button>}
              {batch?.items.some((item) => item.project && (item.status === "ready" || (item.status === "failed" && item.failedStage === "assets"))) && <button className="primary" disabled={batchGenerating || batchAssetsRunning || !providerStatus.replicateConfigured || !providerStatus.elevenLabsConfigured} onClick={generateBatchAssets}>{batchAssetsRunning ? `Assets ${batchAssetProgress.completed}/${batchAssetProgress.total} · ${batchAssetProgress.assetCompleted}/${batchAssetProgress.assetTotal || "?"}` : "Generate batch assets"}</button>}
              {batch?.items.some((item) => item.status === "assets-ready" || (item.status === "failed" && item.failedStage === "render")) && <button className="primary" disabled={batchGenerating || batchAssetsRunning || batchRendering} onClick={renderBatch}>{batchRendering ? `Rendering ${batchRenderProgress.completed}/${batchRenderProgress.total} · ${Math.round(batchRenderProgress.renderProgress * 100)}%` : "Render batch MP4s"}</button>}
            </>
          )}
          {generationMode === "local-test" && batch && batch.items.some((item) => item.status !== "rendered") && <button className="primary" disabled={batchOneClickRunning} onClick={resumeLocalTestBatch}>{batchOneClickRunning ? `Resuming Local Batch ${batchProgress.completed}/${batchProgress.total}...` : "Resume Local Batch (0 API)"}</button>}
          {generationMode === "local-test" && <span className="muted">Local Test uses placeholder visuals and silent audio only. Cloud API actions are disabled in this mode.</span>}
          <span className="muted">Up to 50 topics per batch</span>
        </div>
        {batch && (
          <div className="transcriptList">
            {batch.items.map((item, index) => (
              <div className="transcriptRow" key={item.id}>
                <span>#{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{item.brief.topic}</strong>
                  <p className="muted">{item.status === "ready" ? `Ready · ${item.project?.scenes.length ?? 0} scenes` : item.status === "assets-ready" ? `Assets ready · ${item.project?.scenes.length ?? 0} scenes` : item.status === "rendered" ? `Rendered ✓ · ${item.outputPath ?? ""}` : item.status}{item.error ? ` · ${item.error}` : ""}</p>
                  {item.project && <button onClick={() => onGenerated(item.project!)}>Open project</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="keyRow">
        <input type="password" value={replicateToken} onChange={(e) => setReplicateToken(e.target.value)} placeholder={providerStatus.replicateConfigured ? "Replicate token saved ✓" : "Replicate API token"} />
        <input type="password" value={elevenLabsKey} onChange={(e) => setElevenLabsKey(e.target.value)} placeholder={providerStatus.elevenLabsConfigured ? "ElevenLabs key saved ✓" : "ElevenLabs API key"} />
        <button onClick={saveProviderKeys} disabled={!replicateToken.trim() && !elevenLabsKey.trim()}>Save provider keys</button>
      </div>
            {error && <div className="message errorMessage">{error}</div>}

      <div className="transcriptPanel">
        <div className="timelineHeader">
          <div>
            <p className="eyebrow">PUBLISH ACCOUNTS</p>
            <h3>Connect publishing platforms</h3>
            <p className="muted">YouTube OAuth is available now. Other connectors stay disabled until their provider flow is implemented.</p>
          </div>
          <span className={publishAccounts.find((account) => account.platform === "youtube")?.status === "connected" ? "aiBadge readyBadge" : "aiBadge"}>
            YouTube {publishAccounts.find((account) => account.platform === "youtube")?.status ?? "disconnected"}
          </span>
        </div>
        <div className="keyRow">
          <input value={youtubeClientId} onChange={(event) => setYoutubeClientId(event.target.value)} placeholder="YouTube OAuth client ID" aria-label="YouTube OAuth client ID" />
          <input type="password" value={youtubeClientSecret} onChange={(event) => setYoutubeClientSecret(event.target.value)} placeholder="YouTube OAuth client secret (optional)" aria-label="YouTube OAuth client secret" />
          <button onClick={saveYouTubeOAuth} disabled={!youtubeClientId.trim()}>Save YouTube OAuth</button>
          <button className="primary" onClick={connectYouTube} disabled={youtubeConnecting}>{youtubeConnecting ? "Connecting YouTube..." : "Connect YouTube"}</button>
        </div>
      </div>

      {batch && (
        <div className="transcriptPanel">
          <div className="timelineHeader">
            <div>
              <p className="eyebrow">PUBLISH QUEUE</p>
              <h3>Rendered videos ready for publishing</h3>
              <p className="muted">Create → Produce → Publish. Platform connections and scheduling will plug into this queue without changing the render pipeline.</p>
            </div>
            <span className="aiBadge">{batch.items.filter((item) => item.status === "rendered").length} ready</span>
          </div>
          {batch.items.filter((item) => item.status === "rendered").map((item) => (
            <div className="transcriptRow" key={`publish-${item.id}`}>
              <span>{item.publish?.status ?? "draft"}</span>
              <div>
                <input value={getPublishDraft(item).title ?? item.project?.title ?? item.brief.topic} onChange={(event) => patchPublishDraft(item, { title:event.target.value })} aria-label="Publish title" />
                <textarea value={getPublishDraft(item).description ?? ""} onChange={(event) => patchPublishDraft(item, { description:event.target.value })} placeholder="Description" aria-label="Publish description" />
                <input value={(getPublishDraft(item).hashtags ?? []).join(" ")} onChange={(event) => patchPublishDraft(item, { hashtags:event.target.value.split(/\\s+/).map((tag) => tag.replace(/^#/, "")).filter(Boolean) })} placeholder="#hashtags" aria-label="Publish hashtags" />
                <div className="keyRow">
                  {(["youtube","tiktok","facebook","instagram"] as PublishPlatform[]).map((platform) => <label key={platform}><input type="checkbox" checked={getPublishDraft(item).platforms?.includes(platform) ?? false} onChange={() => togglePublishPlatform(item, platform)} /> {platform}</label>)}
                  <input type="datetime-local" value={getPublishDraft(item).scheduledAt?.slice(0,16) ?? ""} onChange={(event) => patchPublishDraft(item, { scheduledAt:event.target.value || undefined, status:event.target.value ? "scheduled" : "ready" })} aria-label="Publish schedule" />
                </div>
                <div className="keyRow">
                  <button onClick={() => void savePublishDraft(item.id)} disabled={publishSaving === item.id}>{publishSaving === item.id ? "Saving..." : "Save metadata"}</button>\n                   <button onClick={() => void validatePublish(item.id)} disabled={Boolean(publishDrafts[item.id])}>Validate before publish</button>
                  <button className="primary" onClick={() => void queuePublish(item.id)} disabled={Boolean(publishDrafts[item.id])}>Queue publish jobs</button>
                  {publishJobs.filter((job) => job.itemId === item.id).map((job) => <span className="keyRow" key={job.id}><span className={job.status === "published" ? "aiBadge readyBadge" : "aiBadge"}>{job.platform}: {job.status}</span>{job.platform === "youtube" && job.status !== "published" && <button onClick={() => void publishYouTubeJob(job.id, item.id)} disabled={job.status === "publishing"}>{job.status === "publishing" ? "Uploading..." : job.status === "failed" ? "Retry YouTube upload" : "Upload private to YouTube"}</button>}{job.result?.url && <span className="muted">{job.result.url}</span>}</span>)}
                  {publishValidation[item.id]?.valid && <span className="aiBadge readyBadge">Ready to publish ✓</span>}
                </div>
                {publishValidation[item.id] && !publishValidation[item.id].valid && (
                  <div className="message errorMessage">{publishValidation[item.id].issues.map((issue) => issue.message).join(" · ")}</div>
                )}
                <p className="muted">{item.outputPath ?? "Rendered output"}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {project && (
        <div className="transcriptPanel">
          <div className="timelineHeader">
            <div>
              <p className="eyebrow">CONTENT PROJECT</p>
              <h3>{project.title}</h3>
            </div>
            <div className="timelineMeta">
              <span>{project.scenes.length} scenes</span>
              <span>{project.brief.language}</span>
              <span>{project.brief.targetDurationSeconds}s target</span>
            </div>
          </div>

          <div className="keyRow">
            <button className="primary" onClick={generateAndRender} disabled={rendering || !providerStatus.replicateConfigured || !providerStatus.elevenLabsConfigured}>
              {rendering ? (pipelineStage === "assets" ? "Generating images + voices..." : `Rendering ${Math.round(renderProgress * 100)}%...`) : "Generate Assets & Render MP4"}
            </button>
            {rendering && <progress max={1} value={pipelineStage === "assets" ? (assetProgress.total > 0 ? assetProgress.completed / assetProgress.total : undefined) : renderProgress} aria-label="Pipeline progress" />}
            {(!providerStatus.replicateConfigured || !providerStatus.elevenLabsConfigured) && <span className="muted">Add Replicate + ElevenLabs credentials to enable rendering.</span>}
            {pipelineStage === "assets" && <span className="muted">Replicate + ElevenLabs: {assetProgress.completed}/{assetProgress.total || "?"}{assetProgress.kind ? ` · ${assetProgress.kind}` : ""}</span>}
            {pipelineStage === "ready" && <span className="aiBadge readyBadge">Pipeline complete ✓</span>}
            {renderedPath && <span className="muted">Video ready: {renderedPath}</span>}
          </div>

          <p className="muted">{project.script}</p>

          <div className="transcriptList">
            {project.scenes.map((scene) => (
              <div className="transcriptRow" key={scene.id}>
                <span>
                  Scene {String(scene.order).padStart(2, "0")} ·{" "}
                  {scene.estimatedDuration.toFixed(1)}s
                </span>
                <div>
                  <p>{scene.narration}</p>
                  <small>{scene.imagePrompt}</small>
                  {scene.videoPrompt && (
                    <div className="keyRow">
                      <button onClick={() => copyVideoPrompt(scene.id, scene.videoPrompt)}>
                        {copiedSceneId === scene.id ? "Copied Meta prompt ✓" : "Copy Meta video prompt"}
                      </button>
                      {project.assetPlan?.assets.some((asset) => asset.sceneId === scene.id && asset.kind === "video") ? (
                        <>
                          <span className="aiBadge readyBadge">Meta video Ready ✓</span>
                          <button onClick={() => importMetaVideoForScene(scene.id)}>Replace Meta Video</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => importMetaVideoForScene(scene.id)}>Import Meta Video</button>
                          <span className="aiBadge">Waiting for Meta video</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
