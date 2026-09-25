import { useEffect, useState } from "react";
import type {
  ContentBatch,
  ContentFormat,
  ContentLanguage,
  ContentProject,
  PublishPlatform,
  PublishPlan,
  PublishAccount
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
  const [affiliateUrls, setAffiliateUrls] = useState("");
  const [affiliateProducts, setAffiliateProducts] = useState<AffiliateProduct[]>([]);
  const [affiliateImporting, setAffiliateImporting] = useState(false);
  const [affiliateJobs, setAffiliateJobs] = useState<AffiliateContentJob[]>([]);
  const [affiliatePlanning, setAffiliatePlanning] = useState(false);

  useEffect(() => {
    void window.videoEditor.getContentProviderStatus().then(setProviderStatus);
    void window.videoEditor.loadContentBatch().then((saved) => { if (saved) setBatch(saved); });
    void window.videoEditor.getPublishAccounts().then(setPublishAccounts);
  }, []);

  const importAffiliateProducts = async () => {
    const urls=affiliateUrls.split(/\\r?\\n/).map((value)=>value.trim()).filter(Boolean).slice(0,100);
    if (!urls.length || affiliateImporting) return;
    setAffiliateImporting(true); setError(null);
    try { const products:AffiliateProduct[]=[]; for (const url of urls) products.push(await window.videoEditor.importAffiliateProduct(url)); setAffiliateProducts(products); setAffiliateJobs(await window.videoEditor.createAffiliateJobs(products)); }
    catch (importError) { setError(importError instanceof Error ? importError.message : String(importError)); }
    finally { setAffiliateImporting(false); }
  };

  const planAffiliateVideos = async () => {
    if (!affiliateJobs.length || affiliatePlanning || !aiConfigured) return;
    setAffiliatePlanning(true); setError(null);
    try { setBatch(await window.videoEditor.prepareAffiliateBatch(affiliateJobs, language, Math.max(10,duration))); }
    catch (planError) { setError(planError instanceof Error ? planError.message : String(planError)); }
    finally { setAffiliatePlanning(false); }
  };

  const updatePublish = async (itemId: string, patch: Partial<PublishPlan>) => {
    if (!batch) return;
    const item = batch.items.find((entry) => entry.id === itemId);
    if (!item) return;
    const publish: PublishPlan = { status:item.publish?.status ?? "draft", ...item.publish, ...patch };
    const next = await window.videoEditor.updatePublishPlan(batch, itemId, publish);
    setBatch(next);
  };

  const togglePublishPlatform = async (itemId:string, platform:PublishPlatform) => {
    const item = batch?.items.find((entry) => entry.id === itemId);
    if (!item) return;
    const current = item.publish?.platforms ?? [];
    await updatePublish(itemId, { platforms:current.includes(platform) ? current.filter((value) => value !== platform) : [...current, platform] });
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
    const topics = batchTopics.split(/\\r?\\n/).map((value) => value.trim()).filter(Boolean).slice(0, 50);
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
        <div className="timelineHeader"><div><p className="eyebrow">AFFILIATE FACTORY</p><h3>Import marketplace products</h3><p className="muted">Paste one Shopee, Lazada, or TikTok Shop product URL per line. Up to 100 products per batch.</p></div></div>
        <textarea value={affiliateUrls} onChange={(event)=>setAffiliateUrls(event.target.value)} placeholder={"https://...\\nhttps://..."} rows={5} />
        <button onClick={importAffiliateProducts} disabled={affiliateImporting || !affiliateUrls.trim()}>{affiliateImporting ? "Importing..." : "Import Products"}</button>
        {affiliateProducts.length > 0 && <div className="transcriptList">{affiliateProducts.map((product)=><div className="transcriptRow" key={product.id}><span>{product.platform}</span><div><strong>{product.title}</strong><p className="muted">{product.sourceUrl}</p></div></div>)}</div>}\n        {affiliateJobs.length > 0 && <p className="muted">Affiliate queue ready: {affiliateJobs.length} product{affiliateJobs.length === 1 ? "" : "s"} · product attachment requested where supported.</p>}\n        {affiliateJobs.length > 0 && <button onClick={planAffiliateVideos} disabled={affiliatePlanning || !aiConfigured}>{affiliatePlanning ? "Planning affiliate videos..." : "Plan Affiliate Videos"}</button>}
      </div>

      <div className="transcriptPanel">
        <div className="timelineHeader">
          <div><p className="eyebrow">PUBLISH ACCOUNTS</p><h3>Connect publishing channels</h3><p className="muted">OAuth connection comes next. Status stays disconnected until a real provider authorization succeeds.</p></div>
        </div>
        <div className="transcriptList">
          {publishAccounts.map((account) => (
            <div className="transcriptRow" key={account.platform}>
              <span>{account.status}</span>
              <div><strong>{account.platform}</strong><p className="muted">{account.status === "connected" ? account.displayName ?? "Connected" : "Not connected"}</p><button disabled>{account.status === "connected" ? "Connected" : "Connect account"}</button></div>
            </div>
          ))}
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
                <input value={item.publish?.title ?? item.project?.title ?? item.brief.topic} onChange={(event) => void updatePublish(item.id, { title:event.target.value })} aria-label="Publish title" />
                <textarea value={item.publish?.description ?? ""} onChange={(event) => void updatePublish(item.id, { description:event.target.value })} placeholder="Description" aria-label="Publish description" />
                <input value={(item.publish?.hashtags ?? []).join(" ")} onChange={(event) => void updatePublish(item.id, { hashtags:event.target.value.split(/\\s+/).map((tag) => tag.replace(/^#/, "")).filter(Boolean) })} placeholder="#hashtags" aria-label="Publish hashtags" />
                <div className="keyRow">
                  {(["youtube","tiktok","facebook","instagram"] as PublishPlatform[]).map((platform) => <label key={platform}><input type="checkbox" checked={item.publish?.platforms?.includes(platform) ?? false} onChange={() => void togglePublishPlatform(item.id, platform)} /> {platform}</label>)}
                  <input type="datetime-local" value={item.publish?.scheduledAt?.slice(0,16) ?? ""} onChange={(event) => void updatePublish(item.id, { scheduledAt:event.target.value || undefined, status:event.target.value ? "scheduled" : "ready" })} aria-label="Publish schedule" />
                </div>
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
