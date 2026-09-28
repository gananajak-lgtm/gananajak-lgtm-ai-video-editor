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
  const [providerStatus, setProviderStatus] = useState<ContentProviderStatus>({ replicateConfigured:false, elevenLabsConfigured:false, affiliateVideoReady:false });
  const [replicateToken, setReplicateToken] = useState("");
  const [replicateVideoModel,setReplicateVideoModel]=useState("");
  const [elevenLabsKey, setElevenLabsKey] = useState("");
  const [publishAccounts, setPublishAccounts] = useState<PublishAccount[]>([]);
  const [youtubeClientId, setYoutubeClientId] = useState("");
  const [youtubeClientSecret, setYoutubeClientSecret] = useState("");
  const [youtubeConnecting, setYoutubeConnecting] = useState(false);
  const [tiktokClientKey, setTikTokClientKey] = useState("");
  const [tiktokClientSecret, setTikTokClientSecret] = useState("");
  const [tiktokConnecting, setTikTokConnecting] = useState(false);
  const [metaAppId,setMetaAppId]=useState("");
  const [metaAppSecret,setMetaAppSecret]=useState("");
  const [metaRedirectUri,setMetaRedirectUri]=useState("http://127.0.0.1:53682/callback/");
  const [metaConnecting,setMetaConnecting]=useState(false);
  const [metaAuthMode,setMetaAuthMode]=useState<"broker"|"developer">("broker");
  const [metaBrokerUrl,setMetaBrokerUrl]=useState("");
  const [metaBrokerClientId,setMetaBrokerClientId]=useState("");
  const [instagramUploadUrl,setInstagramUploadUrl]=useState("");
  const [instagramPublicBaseUrl,setInstagramPublicBaseUrl]=useState("");
  const [instagramHostingToken,setInstagramHostingToken]=useState("");
  const [instagramStagingItemId,setInstagramStagingItemId]=useState<string|null>(null);
  const [metaDestinations,setMetaDestinations]=useState<Array<{id:string;name:string;instagramBusinessAccountId?:string}>>([]);
  const [publishValidation, setPublishValidation] = useState<Record<string, { valid:boolean; issues:Array<{ field:string; message:string; platform?:PublishPlatform }> }>>({});
  const [publishJobs, setPublishJobs] = useState<PublishJob[]>([]);
  const [publishingJobId, setPublishingJobId] = useState<string | null>(null);
  const [tiktokCreatorInfo, setTikTokCreatorInfo] = useState<{creatorNickname?:string;privacyLevelOptions:import("../shared/content-factory").TikTokPrivacyLevel[];commentDisabled?:boolean;duetDisabled?:boolean;stitchDisabled?:boolean;maxVideoPostDurationSec?:number}|null>(null);
  const [publishDrafts, setPublishDrafts] = useState<Record<string, PublishPlan>>({});
  const [publishSaving, setPublishSaving] = useState<string | null>(null);
  const [contentMode,setContentMode]=useState<"shorts"|"basket">("shorts");
  const [productQuery,setProductQuery]=useState("");
  const [productSearchResults,setProductSearchResults]=useState<AffiliateProduct[]|null>(null);
  const [productSearching,setProductSearching]=useState(false);
  const [productSearchTime,setProductSearchTime]=useState<string|null>(null);
  const [productSearchSource,setProductSearchSource]=useState<"catalog"|"catalog+external"|null>(null);
  const [productProviders,setProductProviders]=useState<Array<{id:string;label:string;configured:boolean;count:number;error?:string}>>([]);
  const [tiktokShopStatus,setTikTokShopStatus]=useState<{connected:boolean;displayName?:string;scopes:string[]}>({connected:false,scopes:[]});
  const [tiktokShopAppKey,setTikTokShopAppKey]=useState("");
  const [tiktokShopAppSecret,setTikTokShopAppSecret]=useState("");
  const [tiktokShopAuthCode,setTikTokShopAuthCode]=useState("");
  const [tiktokShopConnecting,setTikTokShopConnecting]=useState(false);
  const [productReasons,setProductReasons]=useState<Record<string,string[]>>({});
  const [selectedProductId,setSelectedProductId]=useState<string|null>(null);
  const [affiliateUrls, setAffiliateUrls] = useState("");
  const [affiliateProducts, setAffiliateProducts] = useState<AffiliateProduct[]>([]);
  const [affiliateJobs, setAffiliateJobs] = useState<AffiliateContentJob[]>([]);
  const [affiliateImporting, setAffiliateImporting] = useState(false);
  const [affiliatePhotoSelecting,setAffiliatePhotoSelecting]=useState(false);
  const [affiliateBrowserCapturing,setAffiliateBrowserCapturing]=useState(false);
  const [affiliatePhotoPreview,setAffiliatePhotoPreview]=useState<string|null>(null);
  const [affiliateLocalRunning, setAffiliateLocalRunning] = useState(false);
  const [affiliatePreparing,setAffiliatePreparing]=useState(false);
  const [affiliateImportErrors, setAffiliateImportErrors] = useState<string[]>([]);
  const [shopeeAccessGuide,setShopeeAccessGuide]=useState<{headline:string;detail:string;canCreateVideos:boolean;canSearchExternal:boolean;canAutoAttachProduct:boolean}|null>(null);
  const [affiliateReadiness,setAffiliateReadiness]=useState<{video:{ready:boolean;issues:string[]};productAttachment:{ready:boolean;status:"verified"|"unverified"|"not-requested";issues:string[]}}|null>(null);

  useEffect(() => {
    void window.videoEditor.getContentProviderStatus().then((status)=>{ setProviderStatus(status); setReplicateVideoModel(status.videoModel ?? ""); });
    void window.videoEditor.loadContentBatch().then((saved) => { if (saved) setBatch(saved); });
    void window.videoEditor.getPublishAccounts().then(setPublishAccounts);
    void window.videoEditor.getMetaDestinations().then(setMetaDestinations).catch(()=>undefined);
    void window.videoEditor.loadPublishJobs().then((saved) => setPublishJobs(saved.jobs));
    void window.videoEditor.loadAffiliateQueue().then((saved) => { setAffiliateProducts(saved.products); setAffiliateJobs(saved.jobs); });
    void window.videoEditor.getTikTokShopCreatorStatus().then(setTikTokShopStatus).catch(()=>undefined);
    void window.videoEditor.getAffiliateAccessGuide("shopee").then(setShopeeAccessGuide).catch(()=>undefined);
    const unsubscribePublishJobs=window.videoEditor.onPublishJobsUpdated((saved) => setPublishJobs(saved.jobs));
    return () => unsubscribePublishJobs();
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
    if (!item || youtubeConnecting || publishingJobId) return;
    setPublishingJobId(jobId); setError(null);
    try {
      const saved = await window.videoEditor.publishYouTubeJob(jobId, item);
      setPublishJobs(saved.jobs);
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : String(publishError));
      const saved = await window.videoEditor.loadPublishJobs(); setPublishJobs(saved.jobs);
    } finally { setPublishingJobId(null); }
  };

  const reviewTikTokSettings = async (itemId:string) => {
    const item=batch?.items.find((entry)=>entry.id===itemId); if(!item) return;
    setError(null);
    try {
      const info=await window.videoEditor.getTikTokCreatorInfo(); setTikTokCreatorInfo(info);
      const current=getPublishDraft(item);
      const privacy=current.tiktok?.privacyLevel && info.privacyLevelOptions.includes(current.tiktok.privacyLevel) ? current.tiktok.privacyLevel : info.privacyLevelOptions[0];
      patchPublishDraft(item,{tiktok:{...current.tiktok,creatorNickname:info.creatorNickname,privacyLevel:privacy,disableComment:current.tiktok?.disableComment ?? Boolean(info.commentDisabled),disableDuet:current.tiktok?.disableDuet ?? Boolean(info.duetDisabled),disableStitch:current.tiktok?.disableStitch ?? Boolean(info.stitchDisabled)}});
    } catch(reviewError){setError(reviewError instanceof Error?reviewError.message:String(reviewError));}
  };

  const publishTikTokJob = async (jobId:string,itemId:string) => {
    const item=batch?.items.find((entry)=>entry.id===itemId); if(!item || publishingJobId) return;
    setPublishingJobId(jobId);setError(null);
    try{const saved=await window.videoEditor.publishTikTokJob(jobId,item);setPublishJobs(saved.jobs);}
    catch(publishError){setError(publishError instanceof Error?publishError.message:String(publishError));const saved=await window.videoEditor.loadPublishJobs();setPublishJobs(saved.jobs);}
    finally{setPublishingJobId(null);}
  };

  const saveInstagramHosting=async()=>{if(!instagramUploadUrl.trim()||!instagramPublicBaseUrl.trim())return;setError(null);try{await window.videoEditor.configureInstagramHosting(instagramUploadUrl.trim(),instagramPublicBaseUrl.trim(),instagramHostingToken.trim()||undefined);setInstagramHostingToken("");}catch(hostError){setError(hostError instanceof Error?hostError.message:String(hostError));}};
  const stageInstagramVideo=async(item:import("../shared/content-factory").ContentBatchItem)=>{if(instagramStagingItemId)return;if(getPublishDraft(item).meta?.hostedVideoUrl&&getPublishDraft(item).meta?.hostedVideoObjectKey)return;setInstagramStagingItemId(item.id);setError(null);try{const hosted=await window.videoEditor.stageInstagramVideo(item);patchPublishDraft(item,{meta:{...getPublishDraft(item).meta,hostedVideoUrl:hosted.publicUrl,hostedVideoObjectKey:hosted.objectKey,hostedVideoSize:hosted.size,hostedVideoCleanupPending:false}});}catch(hostError){setError(hostError instanceof Error?hostError.message:String(hostError));}finally{setInstagramStagingItemId(null);}};

  const publishInstagramJob=async(jobId:string,itemId:string)=>{const item=batch?.items.find((entry)=>entry.id===itemId);if(!item||publishingJobId)return;setPublishingJobId(jobId);setError(null);try{const saved=await window.videoEditor.publishInstagramJob(jobId,item);setPublishJobs(saved.jobs);}catch(publishError){setError(publishError instanceof Error?publishError.message:String(publishError));const saved=await window.videoEditor.loadPublishJobs();setPublishJobs(saved.jobs);}finally{setPublishingJobId(null);}};

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

  const saveTikTokOAuth = async () => {
    if (!tiktokClientKey.trim() || !tiktokClientSecret.trim()) return;
    setError(null);
    try {
      setPublishAccounts(await window.videoEditor.configureTikTokOAuth(tiktokClientKey.trim(), tiktokClientSecret.trim()));
      setTikTokClientSecret("");
    } catch (oauthError) { setError(oauthError instanceof Error ? oauthError.message : String(oauthError)); }
  };

  const connectTikTok = async () => {
    if (tiktokConnecting) return;
    setTikTokConnecting(true); setError(null);
    try { setPublishAccounts(await window.videoEditor.connectTikTok()); }
    catch (oauthError) { setError(oauthError instanceof Error ? oauthError.message : String(oauthError)); }
    finally { setTikTokConnecting(false); }
  };

  const saveMetaBroker=async()=>{if(!metaBrokerUrl.trim()||!metaBrokerClientId.trim())return;setError(null);try{await window.videoEditor.configureMetaBroker(metaBrokerUrl.trim(),metaBrokerClientId.trim());}catch(oauthError){setError(oauthError instanceof Error?oauthError.message:String(oauthError));}};
  const startMetaBroker=async()=>{if(metaConnecting)return;setMetaConnecting(true);setError(null);try{const destinations=await window.videoEditor.startMetaBrokerAuth();setMetaDestinations(destinations);setPublishAccounts(await window.videoEditor.getPublishAccounts());}catch(oauthError){setError(oauthError instanceof Error?oauthError.message:String(oauthError));}finally{setMetaConnecting(false);}};
  const saveMetaOAuth=async()=>{if(!metaAppId.trim()||!metaAppSecret.trim()||!metaRedirectUri.trim())return;setError(null);try{await window.videoEditor.configureMetaOAuth(metaAppId.trim(),metaAppSecret.trim(),metaRedirectUri.trim());setMetaAppSecret("");}catch(oauthError){setError(oauthError instanceof Error?oauthError.message:String(oauthError));}};
  const connectMeta=async()=>{if(metaConnecting)return;setMetaConnecting(true);setError(null);try{const destinations=await window.videoEditor.connectMeta();setMetaDestinations(destinations);const accounts=await window.videoEditor.getPublishAccounts();setPublishAccounts(accounts);}catch(oauthError){setError(oauthError instanceof Error?oauthError.message:String(oauthError));}finally{setMetaConnecting(false);}};
  const selectMetaDestination=(item:import("../shared/content-factory").ContentBatchItem,pageId:string)=>{const destination=metaDestinations.find((entry)=>entry.id===pageId);const current=getPublishDraft(item);patchPublishDraft(item,{meta:{...current.meta,pageId:destination?.id,pageName:destination?.name,instagramBusinessAccountId:destination?.instagramBusinessAccountId}});};
  const publishFacebookJob=async(jobId:string,itemId:string)=>{const item=batch?.items.find((entry)=>entry.id===itemId);if(!item||publishingJobId)return;setPublishingJobId(jobId);setError(null);try{const saved=await window.videoEditor.publishFacebookJob(jobId,item);setPublishJobs(saved.jobs);}catch(publishError){setError(publishError instanceof Error?publishError.message:String(publishError));const saved=await window.videoEditor.loadPublishJobs();setPublishJobs(saved.jobs);}finally{setPublishingJobId(null);}};

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
      // Importing one link must not erase the existing catalog or completed jobs.
      const previousBySource=new Map(affiliateProducts.map(entry=>[entry.sourceUrl,entry]));
      const reconciled=products.map(entry=>{
        const existing=previousBySource.get(entry.sourceUrl);
        return existing?{...existing,...entry,id:existing.id,
          localImagePaths:existing.localImagePaths,affiliateUrl:existing.affiliateUrl}:entry;
      });
      const nextProducts=Array.from(new Map([...affiliateProducts,...reconciled].map(entry=>[entry.id,entry])).values());
      const newById=new Map(reconciled.map(entry=>[entry.id,entry]));
      const nextJobs=[...affiliateJobs.filter(job=>!newById.has(job.product.id)),
        ...jobs.map((job,index)=>({...job,product:reconciled[index]}))];
      setAffiliateProducts(nextProducts);setAffiliateJobs(nextJobs);setAffiliateImportErrors(failures);
      await window.videoEditor.saveAffiliateQueue(nextProducts,nextJobs);
      if (!products.length && failures.length) setError("No valid affiliate products were imported.");
    } catch (importError) { setError(importError instanceof Error ? importError.message : String(importError)); }
    finally { setAffiliateImporting(false); }
  };

  const captureAffiliateProduct=async(product:AffiliateProduct)=>{
    if(affiliateBrowserCapturing)return;
    setAffiliateBrowserCapturing(true);setError(null);
    try{
      const updated=await window.videoEditor.captureAffiliateProductFromBrowser(product);
      if(!updated.imageUrls.length)throw new Error("ยังไม่พบภาพสินค้าจริงจากหน้าเว็บ");
      const nextProducts=Array.from(new Map([...affiliateProducts,updated].map(entry=>[entry.id,entry])).values());
      const nextJobs=affiliateJobs.map(job=>job.product.id===updated.id?{...job,product:updated}:job);
      await window.videoEditor.saveAffiliateQueue(nextProducts,nextJobs);
      setAffiliateProducts(nextProducts);setAffiliateJobs(nextJobs);
      setProductSearchResults(old=>old?.map(item=>item.id===updated.id?updated:item)??null);
    }catch(error){setError(error instanceof Error?error.message:String(error));}
    finally{setAffiliateBrowserCapturing(false);}
  };
  const selectAffiliatePhotos=async(product:AffiliateProduct)=>{
    if(affiliatePhotoSelecting)return;
    setAffiliatePhotoSelecting(true);setError(null);
    try{
      const updated=await window.videoEditor.selectAffiliateProductPhotos(product);
      const nextProducts=Array.from(new Map([...affiliateProducts,updated].map(entry=>[entry.id,entry])).values());
      const nextJobs=affiliateJobs.map(job=>job.product.id===updated.id?{...job,product:updated}:job);
      await window.videoEditor.saveAffiliateQueue(nextProducts,nextJobs);
      setAffiliateProducts(nextProducts);setAffiliateJobs(nextJobs);
      setProductSearchResults(old=>old?.map(item=>item.id===updated.id?updated:item)??null);
      const first=updated.localImagePaths?.[0];
      if(first)setAffiliatePhotoPreview(await window.videoEditor.readImagePreview(first));
    }catch(error){setError(error instanceof Error?error.message:String(error));}
    finally{setAffiliatePhotoSelecting(false);}
  };
  useEffect(()=>{
    const file=affiliateProducts.find(product=>product.id===selectedProductId)?.localImagePaths?.[0];
    if(!file){setAffiliatePhotoPreview(null);return;}
    let active=true;
    void window.videoEditor.readImagePreview(file).then(image=>{if(active)setAffiliatePhotoPreview(image);}).catch(()=>{if(active)setAffiliatePhotoPreview(null);});
    return ()=>{active=false;};
  },[selectedProductId,affiliateProducts]);
  const createLocalAffiliateVideos = async (jobsOverride?: typeof affiliateJobs) => {
    const jobsToRender=jobsOverride??affiliateJobs;
    if (!jobsToRender.length || affiliateLocalRunning) return;
    const outputDir = await window.videoEditor.chooseBatchOutputFolder(); if (!outputDir) return;
    setAffiliateLocalRunning(true); setError(null); setBatchProgress({ completed:0, total:jobsToRender.length });
    const unsubscribe = window.videoEditor.onContentBatchProgress((progress) => setBatchProgress({ completed:progress.completed, total:progress.total }));
    try { const created=await window.videoEditor.createLocalAffiliateBatch(jobsToRender, outputDir, language, Math.max(10, duration)); setBatch(created); const renderedItem=created.items.find((item)=>item.publish?.affiliate?.productId===jobsToRender[0]?.product.id)??created.items[0]; if(renderedItem&&jobsToRender[0]) { setAffiliateReadiness(await window.videoEditor.getAffiliatePublishReadiness(renderedItem,jobsToRender[0])); const renderedJobs=jobsToRender.map((job)=>job.product.id===renderedItem.publish?.affiliate?.productId && renderedItem.status==="rendered"?{...job,status:"rendered" as const,contentBatchItemId:renderedItem.id}:job); if(renderedItem.status==="failed")setError(renderedItem.error??"ไม่สามารถสร้างคลิปสินค้ารายการนี้ได้"); setAffiliateJobs(renderedJobs); await window.videoEditor.saveAffiliateQueue(Array.from(new Map([...affiliateProducts,...jobsToRender.map(job=>job.product)].map(entry=>[entry.id,entry])).values()),renderedJobs); } }
    catch (localError) { setError(localError instanceof Error ? localError.message : String(localError)); }
    finally { unsubscribe(); setAffiliateLocalRunning(false); }
  };

  const saveProviderKeys = async () => {
    setError(null);
    try {
      let status = providerStatus;
      if (replicateToken.trim()) status = await window.videoEditor.saveReplicateApiToken(replicateToken);
      status = await window.videoEditor.saveReplicateVideoModel(replicateVideoModel);
      if (elevenLabsKey.trim()) status = await window.videoEditor.saveElevenLabsApiKey(elevenLabsKey);
      setProviderStatus(status); setReplicateToken(""); setElevenLabsKey("");
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    }
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

  const matchingProducts=productSearchResults??affiliateProducts;
  const selectedProduct=matchingProducts.find((product)=>product.id===selectedProductId)??affiliateProducts.find((product)=>product.id===selectedProductId)??null;
  const affiliatePreviewItem=batch?.items.find(item=>item.publish?.affiliate?.productId===selectedProductId)??null;
  const affiliateVideoAssets=affiliatePreviewItem?.project?.assetPlan?.assets.filter(asset=>asset.kind==="video"&&asset.source==="generated")??[];
  const affiliateVideoFailures=affiliatePreviewItem?.project?.assetPlan?.jobs.filter(job=>job.kind==="video"&&job.status==="failed")??[];
  const mergedAffiliateCatalog=(product:AffiliateProduct)=>Array.from(new Map([...affiliateProducts,product].map((entry)=>[entry.id,entry])).values());

  if(contentMode==="basket") return (
    <section className="aiPanel basketFactory">
      <div className="modeSwitcher"><button onClick={()=>setContentMode("shorts")}>🎬 สร้างคลิป Shorts</button><button className="primary" aria-pressed="true">🛒 สร้างคลิปปักตะกร้า</button></div>
      <div className="aiPanelHeader"><div><p className="eyebrow">AI SHOPPING VIDEO</p><h3>ค้นหาสินค้า เลือกร้าน แล้วสร้างคลิปขายอัตโนมัติ</h3><p className="muted">ค้นจากสินค้าที่นำเข้าและแหล่งข้อมูลร้านค้าที่เชื่อมต่อ โดยระบบจะไม่แต่งราคา ร้าน หรือยอดขายขึ้นเอง</p></div><span className="aiBadge readyBadge">โหมดปักตะกร้า</span></div>
      <div className="transcriptPanel">
        <div className="timelineHeader"><div><p className="eyebrow">AI VIDEO · ตั้งค่าคลิปจากภาพสินค้าจริง</p><h3>Replicate Image-to-Video</h3><p className="muted">ตั้งค่าโมเดลและ API Token ได้ตรงนี้ เมื่อไม่มีโมเดลหรือ Token ระบบจะใช้ภาพสินค้าแบบ Motion Fallback ไม่ใช่ AI Video</p></div><span className={providerStatus.affiliateVideoReady?"aiBadge readyBadge":"aiBadge"}>{providerStatus.affiliateVideoReady?"AI Video พร้อม ✓":"ยังไม่พร้อมสร้าง AI Video"}</span></div>
        <div className="keyRow">
          <input type="password" aria-label="Replicate API token สำหรับคลิปสินค้า" value={replicateToken} onChange={event=>setReplicateToken(event.target.value)} placeholder={providerStatus.replicateConfigured?"Replicate Token บันทึกแล้ว ✓":"Replicate API Token"}/>
          <input aria-label="Replicate video model สำหรับคลิปสินค้า" value={replicateVideoModel} onChange={event=>setReplicateVideoModel(event.target.value)} placeholder="kwaivgi/kling-v2.1"/>
          <button onClick={saveProviderKeys} disabled={!replicateToken.trim()&&!elevenLabsKey.trim()&&replicateVideoModel===(providerStatus.videoModel??"")}>บันทึก AI Video</button>
        </div>
        <p className="muted">โมเดลตัวอย่าง kwaivgi/kling-v2.1 · รองรับภาพอ้างอิงแบบ start_image · โมเดลอื่นอาจต้องใช้ adapter เฉพาะ</p>
      </div>
      {shopeeAccessGuide&&<div className="transcriptPanel beginnerAffiliateCard"><div><p className="eyebrow">SHOPEE · เริ่มได้ทันที</p><h3>{shopeeAccessGuide.headline}</h3><p className="muted">{shopeeAccessGuide.detail}</p></div><span className="aiBadge readyBadge">✓ ไม่ต้องรอ Open API</span></div>}<div className="shopConnectionBar"><span className={tiktokShopStatus.connected?"aiBadge readyBadge":"aiBadge"}>{tiktokShopStatus.connected?"✓ TikTok Shop Creator เชื่อมแล้ว":"TikTok Shop Creator ยังไม่เชื่อม"}</span><small className="muted">{tiktokShopStatus.connected?`พร้อมดึง Showcase · ${tiktokShopStatus.scopes.join(", ")}`:"ตั้งค่า Shop App แล้วนำ authorization code ที่ได้จาก Creator authorization มาเชื่อม โดย App Secret จะถูกส่งตรงเข้า secure main process"}</small>{!tiktokShopStatus.connected&&<div className="shopAuthFields"><input value={tiktokShopAppKey} onChange={(e)=>setTikTokShopAppKey(e.target.value)} placeholder="TikTok Shop App Key"/><input type="password" value={tiktokShopAppSecret} onChange={(e)=>setTikTokShopAppSecret(e.target.value)} placeholder="TikTok Shop App Secret"/><button onClick={()=>void window.videoEditor.configureTikTokShopApp(tiktokShopAppKey,tiktokShopAppSecret).then(()=>setTikTokShopAppSecret("")).catch((e)=>setError(String(e)))}>บันทึก Shop App</button><button className="primary" disabled={tiktokShopConnecting} onClick={()=>void (async()=>{setTikTokShopConnecting(true);setError(null);try{const status=await window.videoEditor.connectTikTokShopCreator();setTikTokShopStatus(status);setTikTokShopAuthCode("");}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setTikTokShopConnecting(false);}})()}>{tiktokShopConnecting?"รอการอนุญาตจาก TikTok Shop...":"🔐 เชื่อม TikTok Shop Creator"}</button><details><summary>ใช้ authorization code ด้วยตนเอง</summary><div className="shopManualCode"><input value={tiktokShopAuthCode} onChange={(e)=>setTikTokShopAuthCode(e.target.value)} placeholder="Creator authorization code"/><button disabled={!tiktokShopAuthCode.trim()} onClick={()=>void window.videoEditor.completeTikTokShopCreatorAuth(tiktokShopAuthCode).then((status)=>{setTikTokShopStatus(status);setTikTokShopAuthCode("");}).catch((e)=>setError(String(e)))}>เชื่อมด้วย Code</button></div></details></div>}</div><div className="productSearchBar"><input value={productQuery} onChange={(e)=>setProductQuery(e.target.value)} onKeyDown={(e)=>{if(e.key==="Enter")void (async()=>{setProductSearching(true);try{setError(null);const result=await window.videoEditor.searchAffiliateProducts(productQuery);setProductSearchResults(result.products);setProductSearchTime(result.searchedAt);setProductSearchSource(result.source);setProductProviders(result.providers);const entries=await Promise.all(result.products.map(async p=>[p.id,await window.videoEditor.explainAffiliateProduct(p,result.query)] as const));setProductReasons(Object.fromEntries(entries));}catch(searchError){setError(searchError instanceof Error?searchError.message:String(searchError));}finally{setProductSearching(false);}})();}} placeholder="พิมพ์ชื่อสินค้า เช่น เครื่องดูดฝุ่นไร้สาย" autoFocus /><button className="primary" disabled={productSearching} onClick={()=>void (async()=>{setProductSearching(true);setError(null);try{const result=await window.videoEditor.searchAffiliateProducts(productQuery);setProductSearchResults(result.products);setProductSearchTime(result.searchedAt);setProductSearchSource(result.source);setProductProviders(result.providers);const entries=await Promise.all(result.products.map(async p=>[p.id,await window.videoEditor.explainAffiliateProduct(p,result.query)] as const));setProductReasons(Object.fromEntries(entries));}catch(searchError){setError(searchError instanceof Error?searchError.message:String(searchError));}finally{setProductSearching(false);}})()}>{productSearching?"กำลังค้นหา...":"🔎 ค้นหาสินค้า"}</button></div>
      <div className="transcriptPanel"><div className="timelineHeader"><div><p className="eyebrow">สินค้าและร้านแนะนำ</p><h3>{matchingProducts.length ? `พบ ${matchingProducts.length} รายการ` : productSearchResults ? "ไม่พบสินค้าที่ตรงกับคำค้น" : "ยังไม่มีสินค้าในแคตตาล็อก"}</h3>{productSearchTime&&<p className="muted">{productSearchSource==="catalog+external"?"ข้อมูลจากแคตตาล็อก + แหล่งที่เชื่อมต่อ":"ข้อมูลจากแคตตาล็อก"} · ค้นล่าสุด {new Date(productSearchTime).toLocaleString()}</p>}</div>{productProviders.length>0&&<div className="providerStatusRow">{productProviders.map(provider=><small key={provider.id} className="muted">{provider.label}: {provider.error?`ผิดพลาด · ${provider.error}`:provider.configured?`${provider.count} รายการ`:"ยังไม่เชื่อม"}</small>)}</div>}</div>
        <div className="emptyProductState"><strong>{matchingProducts.length?"นำเข้าลิงก์สินค้าเพิ่มเติม":"นำเข้าสินค้าจริงก่อน"}</strong><p className="muted">วางลิงก์สินค้า หรือลิงก์ Affiliate ที่มีอยู่ได้เลย สำหรับ Shopee ไม่ต้องรอ Open API เพื่อเริ่มสร้างคลิป ส่วนการค้นหาและแนบสินค้าอัตโนมัติจะเปิดเมื่อบัญชีมีสิทธิ์รองรับ</p><textarea value={affiliateUrls} onChange={(e)=>setAffiliateUrls(e.target.value)} placeholder={"วางลิงก์สินค้า 1 ลิงก์ต่อบรรทัด"} rows={3}/><button className="primary" onClick={importAffiliateProducts} disabled={!affiliateUrls.trim()||affiliateImporting}>{affiliateImporting?"กำลังดึงข้อมูลสินค้า...":"นำเข้าข้อมูลสินค้า"}</button></div>
        <div className="productResultGrid">{matchingProducts.map((product)=><button type="button" className={selectedProductId===product.id?"productResultCard selected":"productResultCard"} key={product.id} onClick={()=>{setSelectedProductId(product.id);setAffiliateReadiness(null);}}>{product.imageUrls[0]&&<img src={product.imageUrls[0]} alt="" />}<span><strong>{product.title}</strong><small>{product.sellerName??"ไม่ระบุร้าน"} · {product.platform}</small><small>{typeof product.price==="number"?`${product.price.toLocaleString()} ${product.currency??""}`:"ตรวจราคาจากแหล่งข้อมูลสินค้า"}</small>{productReasons[product.id]?.length?<small className="recommendReasons">{productReasons[product.id].join(" · ")}</small>:null}</span></button>)}</div>
      </div>
      {selectedProduct&&affiliatePreviewItem&&<div className="transcriptPanel">
        <div className="timelineHeader"><div><p className="eyebrow">ผลลัพธ์คลิปสินค้าจริง</p>
          <h3>{affiliatePreviewItem.status==="failed"?"ไม่สามารถสร้างคลิปได้":affiliateVideoAssets.length>0?`สร้างวิดีโอ AI ได้ ${affiliateVideoAssets.length} ช็อต`:"ใช้ภาพสินค้าจริงแบบ Motion Fallback"}</h3>
          <p className="muted">{affiliateVideoAssets.length>0?"ตรวจพบไฟล์วิดีโอที่สร้างโดย AI ในงานนี้":"ยังไม่มีไฟล์ AI Video สำเร็จในงานนี้ ไม่ถือว่าภาพนิ่งเคลื่อนไหวเป็น AI Video"}</p></div>
          <span className={affiliateVideoAssets.length>0?"aiBadge readyBadge":"aiBadge"}>{affiliateVideoAssets.length>0?"AI Video generated":"Fallback / pending"}</span>
        </div>
        {affiliateVideoFailures.length>0&&<ul className="readinessIssues">{affiliateVideoFailures.map(job=><li key={job.id}>ช็อต {job.sceneId}: {job.error??"สร้างวิดีโอ AI ไม่สำเร็จ"}</li>)}</ul>}
        {affiliatePreviewItem.status==="failed"&&<p className="message errorMessage">{affiliatePreviewItem.error??"การสร้างคลิปไม่สำเร็จ"}</p>}
      </div>}
      {selectedProduct&&<div className="transcriptPanel">
        <div className="timelineHeader"><div><p className="eyebrow">ภาพอ้างอิงสินค้าจริง</p><h3>เพิ่มรูปภาพจากเครื่อง</h3>
        <p className="muted">ระบบจะลองดึงภาพจากหน้าเว็บก่อน หากเว็บไซต์ไม่อนุญาตให้เข้าถึงภาพ จึงค่อยใช้การเลือกรูปจากเครื่องเป็นทางเลือกสำรอง</p></div>
        <span className={selectedProduct.localImagePaths?.length?"aiBadge readyBadge":"aiBadge"}>{selectedProduct.localImagePaths?.length?`มีภาพอ้างอิง ${selectedProduct.localImagePaths.length} รูป`:"ยังไม่มีรูปที่เลือก"}</span></div>
        <div className="keyRow"><button className="primary" disabled={affiliateBrowserCapturing} onClick={()=>void captureAffiliateProduct(selectedProduct)}>{affiliateBrowserCapturing?"กำลังเปิดหน้าเว็บและตรวจหารูป...":"🌐 ดึงรูปสินค้าจากหน้าเว็บอีกครั้ง"}</button> <button className="primary" disabled={affiliatePhotoSelecting} onClick={()=>void selectAffiliatePhotos(selectedProduct)}>{affiliatePhotoSelecting?"กำลังเพิ่มรูป...":"📷 เลือกรูปสินค้าจากเครื่อง"}</button>
        {affiliatePhotoPreview&&<img src={affiliatePhotoPreview} alt="รูปสินค้าที่เลือกเพื่อใช้สร้างวิดีโอ" style={{maxWidth:110,maxHeight:110,objectFit:"contain"}}/>}</div>
      </div>}
      {selectedProduct&&affiliateReadiness&&<div className="transcriptPanel readinessPanel"><div className="readinessRow"><span className={affiliateReadiness.video.ready?"aiBadge readyBadge":"aiBadge"}>{affiliateReadiness.video.ready?"🟢 พร้อมโพสต์วิดีโอ":"⚪ วิดีโอยังไม่พร้อมโพสต์"}</span><span className={affiliateReadiness.productAttachment.ready?"aiBadge readyBadge":"aiBadge"}>{affiliateReadiness.productAttachment.status==="not-requested"?"⚪ ไม่ได้ขอแนบสินค้า":affiliateReadiness.productAttachment.ready?"🟢 พร้อมแนบสินค้า":"🟡 การแนบสินค้ายังไม่พร้อม"}</span></div>{affiliateReadiness.video.issues.length>0&&<ul className="readinessIssues">{affiliateReadiness.video.issues.map((issue,index)=><li key={`video-${index}`}>{issue}</li>)}</ul>}{affiliateReadiness.productAttachment.issues.length>0&&<ul className="readinessIssues">{affiliateReadiness.productAttachment.issues.map((issue,index)=><li key={`attach-${index}`}>{issue}</li>)}</ul>}</div>}{selectedProduct&&<div className="transcriptPanel selectedProductPanel"><div><p className="eyebrow">สินค้าที่เลือก</p><h3>{selectedProduct.title}</h3><p className="muted">{selectedProduct.sellerName??"ไม่ระบุร้าน"} · {selectedProduct.description??"ไม่มีคำอธิบายสินค้า"}</p></div><div className="keyRow"><select value={language} onChange={(e)=>setLanguage(e.target.value as ContentLanguage)}><option value="th">ภาษาไทย</option><option value="en">English</option></select><input type="number" min={10} max={180} value={duration} onChange={(e)=>setDuration(Number(e.target.value)||30)} aria-label="ความยาวคลิป"/><button className="primary" onClick={()=>void (async()=>{if(affiliatePreparing||affiliateLocalRunning)return;setAffiliatePreparing(true);setError(null);try{const jobs=await window.videoEditor.createAffiliateJobs([selectedProduct]);setAffiliateJobs(jobs);const catalog=mergedAffiliateCatalog(selectedProduct);setAffiliateProducts(catalog);await window.videoEditor.saveAffiliateQueue(catalog,jobs);setAffiliateReadiness(null);}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setAffiliatePreparing(false);}})()} disabled={affiliateLocalRunning||affiliatePreparing}>{affiliatePreparing?"กำลังเตรียม...":"✨ เตรียมคลิปปักตะกร้าอัตโนมัติ"}</button><button className="primary" onClick={()=>void (async()=>{setError(null);try{const jobs=await window.videoEditor.createAffiliateJobs([selectedProduct]);setAffiliateJobs(jobs);const catalog=mergedAffiliateCatalog(selectedProduct);setAffiliateProducts(catalog);await window.videoEditor.saveAffiliateQueue(catalog,jobs);await createLocalAffiliateVideos(jobs);}catch(e){setError(e instanceof Error?e.message:String(e));}})()} disabled={affiliateLocalRunning||affiliatePreparing}>{affiliateLocalRunning?"กำลังสร้างคลิป...":"🎬 สร้างคลิปจากสินค้านี้"}</button></div></div>}
      {affiliateImportErrors.length>0&&<div className="message errorMessage">{affiliateImportErrors.join(" · ")}</div>}{error&&<div className="message errorMessage">{error}</div>}
    </section>
  );

  return (
    <section className="aiPanel">
      <div className="modeSwitcher"><button className="primary" aria-pressed="true">🎬 สร้างคลิป Shorts</button><button onClick={()=>setContentMode("basket")}>🛒 สร้างคลิปปักตะกร้า</button></div>
      <div className="aiPanelHeader">
        <div>
          <p className="eyebrow">โรงงานสร้างคอนเทนต์ AI</p>
          <h3>เริ่มจากหัวข้อ ไม่ต้องเริ่มจากไทม์ไลน์</h3>
          <p className="muted">
            Generate a complete narration script plus production-ready scenes,
            image prompts, video prompts, timing, and sound-effect hints.
          </p>
        </div>
        <span className={generationMode === "local-test" || aiConfigured ? "aiBadge readyBadge" : "aiBadge"}>
          {generationMode === "local-test" ? "ทดสอบในเครื่อง · ไม่เรียก API" : aiConfigured ? "พร้อมสร้าง" : "ต้องตั้งค่า API key"}
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
          placeholder="หัวข้อ เช่น เกาะตุ๊กตา"
        />
        <select value={generationMode} onChange={(event) => setGenerationMode(event.target.value as "cloud" | "local-test")} aria-label="โหมดการสร้าง">
          <option value="cloud">คุณภาพ Cloud</option>
          <option value="local-test">ทดสอบในเครื่อง · ไม่มีค่า API</option>
        </select>
        <select
          value={format}
          onChange={(event) => setFormat(event.target.value as ContentFormat)}
        >
          <option value="short">คลิปสั้น</option>
          <option value="episode">ตอนยาว</option>
        </select>
        <select
          value={language}
          onChange={(event) => setLanguage(event.target.value as ContentLanguage)}
        >
          <option value="th">ไทย</option>
          <option value="en">อังกฤษ</option>
        </select>
        <input
          type="number"
          min={10}
          max={7200}
          value={duration}
          onChange={(event) => setDuration(Number(event.target.value) || 60)}
          aria-label="ความยาวเป้าหมาย (วินาที)"
        />
        <button
          className="primary"
          disabled={(generationMode === "cloud" && !aiConfigured) || !topic.trim() || generating}
          onClick={generate}
        >
          {generating ? "กำลังวางแผนวิดีโอ..." : generationMode === "local-test" ? "สร้างโปรเจกต์ทดสอบในเครื่อง" : "สร้างบท + ฉาก"}
        </button>
        {generationMode === "local-test" ? (
          <button className="primary" disabled={!topic.trim() || oneClickRunning} onClick={createLocalTestVideo}>
            {oneClickRunning ? (pipelineStage === "render" ? `Rendering Local Test ${Math.round(renderProgress * 100)}%...` : "Building Local Test...") : "Create Local Test MP4 (0 API)"}
          </button>
        ) : (
          <button className="primary" disabled={!aiConfigured || !topic.trim() || oneClickRunning || !providerStatus.replicateConfigured || !providerStatus.elevenLabsConfigured} onClick={createVideoOneClick}>
            {oneClickRunning ? (pipelineStage === "render" ? `Rendering ${Math.round(renderProgress * 100)}%...` : "กำลังสร้างวิดีโอ...") : "สร้างวิดีโอ (คลิกเดียว)"}
          </button>
        )}
      </div>


      <div className="transcriptPanel">
        <div className="timelineHeader">
          <div>
            <p className="eyebrow">สร้างวิดีโอหลายรายการ</p>
            <h3>สร้างหลายโปรเจกต์จากรายการหัวข้อ</h3>
            <p className="muted">One topic per line. The current format, language, and duration settings apply to every item.</p>
          </div>
          <span className="aiBadge">{batchTopics.split(/\\r?\\n/).filter((value) => value.trim()).length} topics</span>
        </div>
        <textarea value={batchTopics} onChange={(event) => setBatchTopics(event.target.value)} placeholder={"Island of the Dolls\\nAokigahara Forest\\nMary Celeste"} rows={6} />
        <div className="keyRow">
          {generationMode === "local-test" ? (
            <button className="primary" disabled={!batchTopics.trim() || batchOneClickRunning} onClick={createLocalTestBatch}>{batchOneClickRunning ? `Creating Local Batch ${batchProgress.completed}/${batchProgress.total}...` : "Create Local Batch MP4s (0 API)"}</button>
          ) : (
            <button className="primary" disabled={!aiConfigured || !batchTopics.trim() || batchOneClickRunning || !providerStatus.replicateConfigured || !providerStatus.elevenLabsConfigured} onClick={createBatchVideosOneClick}>{batchOneClickRunning ? "กำลังสร้างวิดีโอแบบชุด..." : "สร้างวิดีโอแบบชุด (คลิกเดียว)"}</button>
          )}
          {generationMode === "cloud" && (
            <>
              <button className="primary" disabled={!aiConfigured || !batchTopics.trim() || batchGenerating || batchOneClickRunning} onClick={generateBatch}>
                {batchGenerating ? `Preparing ${batchProgress.completed}/${batchProgress.total}...` : "สร้างโปรเจกต์แบบชุด"}
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
                  {item.project && <button onClick={() => onGenerated(item.project!)}>เปิดโปรเจกต์</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="transcriptPanel">
        <div className="timelineHeader"><div><p className="eyebrow">AI Video</p><h3>วิดีโอสินค้าจากภาพอ้างอิง</h3><p className="muted">โหมดคลิปปักตะกร้าจะใช้ภาพสินค้าจริงเป็น reference เพื่อสร้างภาพเคลื่อนไหวก่อน และใช้ motion จากภาพนิ่งเป็น fallback เมื่อยังไม่ได้ตั้งโมเดลวิดีโอ</p></div><span className={providerStatus.affiliateVideoReady ? "aiBadge readyBadge" : "aiBadge"}>{providerStatus.affiliateVideoReady ? "AI Video พร้อม ✓" : "ใช้ Motion Fallback"}</span></div>
        <div className="keyRow">
          <input type="password" value={replicateToken} onChange={(e) => setReplicateToken(e.target.value)} placeholder={providerStatus.replicateConfigured ? "Replicate token saved ✓" : "Replicate API token"} />
          <input value={replicateVideoModel} onChange={(e)=>setReplicateVideoModel(e.target.value)} placeholder="ตัวอย่าง: kwaivgi/kling-v2.1 (Image-to-Video)" aria-label="Replicate video model" />
          <input type="password" value={elevenLabsKey} onChange={(e) => setElevenLabsKey(e.target.value)} placeholder={providerStatus.elevenLabsConfigured ? "ElevenLabs key saved ✓" : "ElevenLabs API key"} />
          <button onClick={saveProviderKeys} disabled={!replicateToken.trim() && !elevenLabsKey.trim() && replicateVideoModel===(providerStatus.videoModel ?? "")}>บันทึกผู้ให้บริการ</button>
        </div>
        <p className="muted">ตัวอย่างที่มี adapter รองรับ: kwaivgi/kling-v2.1 (วิดีโอ 5 วินาทีต่อช็อต) · โมเดลอื่นอาจใช้ชื่อ input ต่างกันและต้องทดสอบก่อนใช้งานจริง หากไม่ได้ตั้งค่า ระบบใช้ภาพสินค้าและ motion fallback ซึ่งไม่ใช่ AI Video</p>
      </div>
            {error && <div className="message errorMessage">{error}</div>}

      <div className="transcriptPanel">
        <div className="timelineHeader">
          <div>
            <p className="eyebrow">บัญชีสำหรับเผยแพร่</p>
            <h3>เชื่อมต่อแพลตฟอร์มเผยแพร่</h3>
            <p className="muted">YouTube OAuth is available now. Other connectors stay disabled until their provider flow is implemented.</p>
          </div>
          <span className={publishAccounts.find((account) => account.platform === "youtube")?.status === "connected" ? "aiBadge readyBadge" : "aiBadge"}>
            YouTube {publishAccounts.find((account) => account.platform === "youtube")?.status ?? "disconnected"}
          </span>
        </div>
        <div className="keyRow">
          <input value={youtubeClientId} onChange={(event) => setYoutubeClientId(event.target.value)} placeholder="YouTube OAuth client ID" aria-label="YouTube OAuth client ID" />
          <input type="password" value={youtubeClientSecret} onChange={(event) => setYoutubeClientSecret(event.target.value)} placeholder="YouTube OAuth client secret (optional)" aria-label="YouTube OAuth client secret" />
          <button onClick={saveYouTubeOAuth} disabled={!youtubeClientId.trim()}>บันทึก YouTube OAuth</button>
          <button className="primary" onClick={connectYouTube} disabled={youtubeConnecting}>{youtubeConnecting ? "กำลังเชื่อมต่อ YouTube..." : "เชื่อมต่อ YouTube"}</button>
        </div>
        <div className="keyRow">
          <input value={tiktokClientKey} onChange={(event) => setTikTokClientKey(event.target.value)} placeholder="TikTok client key" aria-label="TikTok client key" />
          <input type="password" value={tiktokClientSecret} onChange={(event) => setTikTokClientSecret(event.target.value)} placeholder="TikTok client secret" aria-label="TikTok client secret" />
          <button onClick={saveTikTokOAuth} disabled={!tiktokClientKey.trim() || !tiktokClientSecret.trim()}>บันทึก TikTok OAuth</button>
          <button className="primary" onClick={connectTikTok} disabled={tiktokConnecting}>{tiktokConnecting ? "กำลังเชื่อมต่อ TikTok..." : "เชื่อมต่อ TikTok"}</button>
          <span className={publishAccounts.find((account) => account.platform === "tiktok")?.status === "connected" ? "aiBadge readyBadge" : "aiBadge"}>TikTok {publishAccounts.find((account) => account.platform === "tiktok")?.status ?? "disconnected"}</span>
        </div>
        <p className="muted">TikTok Desktop redirect URI: register <code>http://127.0.0.1:*/callback/</code> in Login Kit. Direct Post requires approved <code>video.publish</code> access.</p><div className="keyRow"><label><input type="radio" name="meta-auth-mode" checked={metaAuthMode==="broker"} onChange={()=>setMetaAuthMode("broker")} /> Production Broker</label><label><input type="radio" name="meta-auth-mode" checked={metaAuthMode==="developer"} onChange={()=>setMetaAuthMode("developer")} /> Developer Mode</label><span className={publishAccounts.find((account)=>account.platform==="facebook")?.status==="connected"?"aiBadge readyBadge":"aiBadge"}>Meta {publishAccounts.find((account)=>account.platform==="facebook")?.status??"disconnected"}</span></div>{metaAuthMode==="broker"?<><div className="keyRow"><input value={metaBrokerUrl} onChange={(event)=>setMetaBrokerUrl(event.target.value)} placeholder="https://auth.example.com" aria-label="Meta Auth Broker URL" /><input value={metaBrokerClientId} onChange={(event)=>setMetaBrokerClientId(event.target.value)} placeholder="Desktop client ID" aria-label="Meta broker client ID" /><button onClick={saveMetaBroker} disabled={!metaBrokerUrl.trim()||!metaBrokerClientId.trim()}>บันทึก Production Broker</button><button className="primary" onClick={startMetaBroker} disabled={metaConnecting}>{metaConnecting?"กำลังเริ่ม...":"เชื่อมต่อผ่าน Broker"}</button></div><p className="muted">Production mode ไม่เก็บ Meta App Secret ในแอป Desktop โดย App Secret ต้องอยู่ที่ Auth Broker ฝั่งเซิร์ฟเวอร์เท่านั้น เมื่อ Login สำเร็จ browser จะส่งกลับเข้าแอปอัตโนมัติ</p></>:<><div className="keyRow"><input value={metaAppId} onChange={(event)=>setMetaAppId(event.target.value)} placeholder="Meta App ID" aria-label="Meta App ID" /><input type="password" value={metaAppSecret} onChange={(event)=>setMetaAppSecret(event.target.value)} placeholder="Meta App Secret" aria-label="Meta App Secret" /><input value={metaRedirectUri} onChange={(event)=>setMetaRedirectUri(event.target.value)} placeholder="http://127.0.0.1:53682/callback/" aria-label="Meta OAuth redirect URI" /><button onClick={saveMetaOAuth} disabled={!metaAppId.trim()||!metaAppSecret.trim()||!metaRedirectUri.trim()}>บันทึก Meta OAuth</button><button className="primary" onClick={connectMeta} disabled={metaConnecting}>{metaConnecting?"กำลังเชื่อมต่อ Meta...":"เชื่อมต่อ Facebook / Instagram"}</button></div><p className="muted"><strong>Developer OAuth mode:</strong> App Secret ใน Desktop ใช้สำหรับ development/testing เท่านั้น ไม่ใช่ production credential architecture</p><p className="muted">Meta redirect URI ต้องตรงกับ URI ที่ลงทะเบียนใน Meta App ทุกตัวอักษร รวม port และ path</p></>}<div className="keyRow"><input value={instagramUploadUrl} onChange={(event)=>setInstagramUploadUrl(event.target.value)} placeholder="Instagram staging PUT endpoint" /><input value={instagramPublicBaseUrl} onChange={(event)=>setInstagramPublicBaseUrl(event.target.value)} placeholder="Public HTTPS base URL" /><input type="password" value={instagramHostingToken} onChange={(event)=>setInstagramHostingToken(event.target.value)} placeholder="Hosting bearer token (optional)" /><button onClick={saveInstagramHosting} disabled={!instagramUploadUrl.trim()||!instagramPublicBaseUrl.trim()}>บันทึก Instagram Hosting</button></div>
      </div>

      {batch && (
        <div className="transcriptPanel">
          <div className="timelineHeader">
            <div>
              <p className="eyebrow">คิวเผยแพร่</p>
              <h3>วิดีโอที่เรนเดอร์แล้วพร้อมเผยแพร่</h3>
              <p className="muted">Create → Produce → Publish. Platform connections and scheduling will plug into this queue without changing the render pipeline.</p>
            </div>
            <span className="aiBadge">{batch.items.filter((item) => item.status === "rendered").length} ready</span>
          </div>
          {batch.items.filter((item) => item.status === "rendered").map((item) => (
            <div className="transcriptRow" key={`publish-${item.id}`}>
              <span>{item.publish?.status ?? "draft"}</span>
              <div>
                <input value={getPublishDraft(item).title ?? item.project?.title ?? item.brief.topic} onChange={(event) => patchPublishDraft(item, { title:event.target.value })} aria-label="ชื่อสำหรับเผยแพร่" />
                <textarea value={getPublishDraft(item).description ?? ""} onChange={(event) => patchPublishDraft(item, { description:event.target.value })} placeholder="คำอธิบาย" aria-label="คำอธิบายสำหรับเผยแพร่" />
                <input value={(getPublishDraft(item).hashtags ?? []).join(" ")} onChange={(event) => patchPublishDraft(item, { hashtags:event.target.value.split(/\\s+/).map((tag) => tag.replace(/^#/, "")).filter(Boolean) })} placeholder="#hashtags" aria-label="แฮชแท็กสำหรับเผยแพร่" />
                <div className="keyRow">
                  {(["youtube","tiktok","facebook","instagram"] as PublishPlatform[]).map((platform) => <label key={platform}><input type="checkbox" checked={getPublishDraft(item).platforms?.includes(platform) ?? false} onChange={() => togglePublishPlatform(item, platform)} /> {platform}</label>)}
                  <input type="datetime-local" value={getPublishDraft(item).scheduledAt?.slice(0,16) ?? ""} onChange={(event) => patchPublishDraft(item, { scheduledAt:event.target.value || undefined, status:event.target.value ? "scheduled" : "ready" })} aria-label="กำหนดเวลาเผยแพร่" />
                </div>
                <div className="keyRow">
                  <button onClick={() => void savePublishDraft(item.id)} disabled={publishSaving === item.id}>{publishSaving === item.id ? "กำลังบันทึก..." : "บันทึกข้อมูลเผยแพร่"}</button>
                  <button onClick={() => void validatePublish(item.id)} disabled={Boolean(publishDrafts[item.id])}>ตรวจสอบก่อนเผยแพร่</button>
                  <button className="primary" onClick={() => void queuePublish(item.id)} disabled={Boolean(publishDrafts[item.id])}>เข้าคิวเผยแพร่</button>
                  {getPublishDraft(item).platforms?.some((platform)=>platform==="facebook"||platform==="instagram") && <div className="keyRow"><select value={getPublishDraft(item).meta?.pageId??""} onChange={(event)=>selectMetaDestination(item,event.target.value)}><option value="" disabled>เลือก Facebook Page</option>{metaDestinations.map((destination)=><option key={destination.id} value={destination.id}>{destination.name}{destination.instagramBusinessAccountId?" · Instagram linked":""}</option>)}</select>{getPublishDraft(item).platforms?.includes("instagram")&&!getPublishDraft(item).meta?.instagramBusinessAccountId&&<span className="muted">Page นี้ยังไม่มี Instagram Professional account ที่เชื่อมอยู่</span>}{getPublishDraft(item).platforms?.includes("instagram")&&<><input value={getPublishDraft(item).meta?.hostedVideoUrl??""} onChange={(event)=>patchPublishDraft(item,{meta:{...getPublishDraft(item).meta,hostedVideoUrl:event.target.value}})} placeholder="Public HTTPS video URL for Instagram" aria-label="Instagram hosted video URL" /><button onClick={()=>void stageInstagramVideo(item)} disabled={instagramStagingItemId===item.id}>{instagramStagingItemId===item.id?"กำลังอัปโหลดชั่วคราว...":"อัปโหลด MP4 สำหรับ Instagram"}</button><label><input type="checkbox" checked={Boolean(getPublishDraft(item).meta?.shareInstagramReelToFeed)} onChange={(event)=>patchPublishDraft(item,{meta:{...getPublishDraft(item).meta,shareInstagramReelToFeed:event.target.checked}})} /> แชร์ Reel ไป Feed</label></>}</div>}{getPublishDraft(item).platforms?.includes("tiktok") && <div className="keyRow">
                    <button onClick={() => void reviewTikTokSettings(item.id)}>ตรวจสิทธิ์และตัวเลือก TikTok</button>
                    {tiktokCreatorInfo && <><span className="muted">{tiktokCreatorInfo.creatorNickname ?? "TikTok creator"}</span><select value={getPublishDraft(item).tiktok?.privacyLevel ?? ""} onChange={(event)=>patchPublishDraft(item,{tiktok:{...getPublishDraft(item).tiktok,privacyLevel:event.target.value as import("../shared/content-factory").TikTokPrivacyLevel}})}><option value="" disabled>เลือกความเป็นส่วนตัว</option>{tiktokCreatorInfo.privacyLevelOptions.map((level)=><option value={level} key={level}>{level}</option>)}</select><label><input type="checkbox" checked={Boolean(getPublishDraft(item).tiktok?.isAigc)} onChange={(event)=>patchPublishDraft(item,{tiktok:{...getPublishDraft(item).tiktok,isAigc:event.target.checked}})} /> AI-generated content</label><label><input type="checkbox" checked={Boolean(getPublishDraft(item).tiktok?.commercialContent)} onChange={(event)=>patchPublishDraft(item,{tiktok:{...getPublishDraft(item).tiktok,commercialContent:event.target.checked,brandOrganic:event.target.checked?getPublishDraft(item).tiktok?.brandOrganic:false,brandedContent:event.target.checked?getPublishDraft(item).tiktok?.brandedContent:false}})} /> เนื้อหาเชิงพาณิชย์</label>{getPublishDraft(item).tiktok?.commercialContent && <><label><input type="checkbox" checked={Boolean(getPublishDraft(item).tiktok?.brandOrganic)} onChange={(event)=>patchPublishDraft(item,{tiktok:{...getPublishDraft(item).tiktok,brandOrganic:event.target.checked}})} /> Your Brand</label><label><input type="checkbox" checked={Boolean(getPublishDraft(item).tiktok?.brandedContent)} onChange={(event)=>patchPublishDraft(item,{tiktok:{...getPublishDraft(item).tiktok,brandedContent:event.target.checked}})} /> Branded Content</label></>}<label><input type="checkbox" checked={Boolean(getPublishDraft(item).tiktok?.musicUsageConfirmed)} onChange={(event)=>patchPublishDraft(item,{tiktok:{...getPublishDraft(item).tiktok,musicUsageConfirmed:event.target.checked}})} /> By posting, you agree to TikTok's {getPublishDraft(item).tiktok?.brandedContent ? "Branded Content Policy and " : ""}Music Usage Confirmation</label><label><input type="checkbox" checked={Boolean(getPublishDraft(item).tiktok?.disableComment)} disabled={Boolean(tiktokCreatorInfo.commentDisabled)} onChange={(event)=>patchPublishDraft(item,{tiktok:{...getPublishDraft(item).tiktok,disableComment:event.target.checked}})} /> ปิดคอมเมนต์</label><label><input type="checkbox" checked={Boolean(getPublishDraft(item).tiktok?.disableDuet)} disabled={Boolean(tiktokCreatorInfo.duetDisabled)} onChange={(event)=>patchPublishDraft(item,{tiktok:{...getPublishDraft(item).tiktok,disableDuet:event.target.checked}})} /> ปิด Duet</label><label><input type="checkbox" checked={Boolean(getPublishDraft(item).tiktok?.disableStitch)} disabled={Boolean(tiktokCreatorInfo.stitchDisabled)} onChange={(event)=>patchPublishDraft(item,{tiktok:{...getPublishDraft(item).tiktok,disableStitch:event.target.checked}})} /> ปิด Stitch</label></>}
                  </div>}
                  {publishJobs.filter((job) => job.itemId === item.id).map((job) => <span className="keyRow" key={job.id}><span className={job.status === "published" ? "aiBadge readyBadge" : "aiBadge"}>{job.platform}: {job.status}</span>{job.platform === "youtube" && job.status !== "published" && <button onClick={() => void publishYouTubeJob(job.id, item.id)} disabled={job.status === "publishing" || job.status === "blocked" || publishingJobId === job.id}>{job.status === "publishing" ? "กำลังอัปโหลด..." : job.status === "blocked" ? `Scheduled ${job.scheduledAt ? new Date(job.scheduledAt).toLocaleString() : ""}` : job.status === "failed" ? "ลองอัปโหลด YouTube อีกครั้ง" : "อัปโหลดไป YouTube แบบส่วนตัว"}</button>}{job.platform === "tiktok" && job.status !== "published" && <button onClick={() => void publishTikTokJob(job.id,item.id)} disabled={job.status === "publishing" || job.status === "blocked" || publishingJobId === job.id || !item.publish?.tiktok?.privacyLevel || !item.publish?.tiktok?.musicUsageConfirmed || Boolean(item.publish?.tiktok?.commercialContent && !item.publish?.tiktok?.brandOrganic && !item.publish?.tiktok?.brandedContent) || Boolean(item.publish?.tiktok?.brandedContent && item.publish?.tiktok?.privacyLevel === "SELF_ONLY")}>{job.status === "publishing" ? "กำลังส่ง TikTok..." : job.status === "processing" ? "ตรวจสถานะ TikTok อีกครั้ง" : job.status === "failed" && job.externalPublishId ? "ตรวจสถานะโพสต์เดิม" : job.status === "failed" ? "ลองส่ง TikTok อีกครั้ง" : "ยืนยันและเผยแพร่ TikTok"}</button>}{job.platform === "facebook" && job.status !== "published" && <button onClick={() => void publishFacebookJob(job.id,item.id)} disabled={job.status==="publishing"||job.status==="blocked"||publishingJobId===job.id||!item.publish?.meta?.pageId}>{job.status==="publishing"?"กำลังส่ง Facebook...":job.status==="processing"?"ตรวจสถานะ Facebook อีกครั้ง":job.status==="failed"&&job.externalPublishId?"ตรวจ Reel session เดิม":job.status==="failed"?"ลองส่ง Facebook อีกครั้ง":"เผยแพร่ Facebook Reel"}</button>}{job.platform === "instagram" && job.status !== "published" && <button onClick={() => void publishInstagramJob(job.id,item.id)} disabled={job.status==="publishing"||job.status==="blocked"||publishingJobId===job.id||!item.publish?.meta?.instagramBusinessAccountId||!item.publish?.meta?.hostedVideoUrl}>{job.status==="publishing"?"กำลังส่ง Instagram...":job.status==="processing"?"ตรวจสถานะ Instagram อีกครั้ง":job.status==="failed"&&job.externalPublishId?"ตรวจ container เดิม":job.status==="failed"?"ลองส่ง Instagram อีกครั้ง":"เผยแพร่ Instagram Reel"}</button>}{job.result?.url && <button onClick={() => void navigator.clipboard.writeText(job.result?.url ?? "")}>คัดลอกลิงก์</button>}{job.platform === "tiktok" && job.status === "processing" && <span className="muted">TikTok กำลังประมวลผลโพสต์{typeof job.uploadedBytes === "number" ? ` · รับข้อมูลแล้ว ${job.uploadedBytes.toLocaleString()} bytes` : ""}</span>}{job.statusDetail && <span className="muted">{job.statusDetail}</span>}{job.error && <span className="muted">{job.error}</span>}</span>)}
                  {publishValidation[item.id]?.valid && <span className="aiBadge readyBadge">พร้อมเผยแพร่ ✓</span>}
                </div>
                {publishValidation[item.id] && !publishValidation[item.id].valid && (
                  <div className="message errorMessage">{publishValidation[item.id].issues.map((issue) => issue.message).join(" · ")}</div>
                )}
                <p className="muted">{item.outputPath ?? "ไฟล์วิดีโอที่เรนเดอร์แล้ว"}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {project && (
        <div className="transcriptPanel">
          <div className="timelineHeader">
            <div>
              <p className="eyebrow">โปรเจกต์คอนเทนต์</p>
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
              {rendering ? (pipelineStage === "assets" ? "กำลังสร้างภาพและเสียง..." : `Rendering ${Math.round(renderProgress * 100)}%...`) : "สร้างสื่อและเรนเดอร์ MP4"}
            </button>
            {rendering && <progress max={1} value={pipelineStage === "assets" ? (assetProgress.total > 0 ? assetProgress.completed / assetProgress.total : undefined) : renderProgress} aria-label="Pipeline progress" />}
            {(!providerStatus.replicateConfigured || !providerStatus.elevenLabsConfigured) && <span className="muted">Add Replicate + ElevenLabs credentials to enable rendering.</span>}
            {pipelineStage === "assets" && <span className="muted">Replicate + ElevenLabs: {assetProgress.completed}/{assetProgress.total || "?"}{assetProgress.kind ? ` · ${assetProgress.kind}` : ""}</span>}
            {pipelineStage === "ready" && <span className="aiBadge readyBadge">กระบวนการเสร็จสมบูรณ์ ✓</span>}
            {renderedPath && <span className="muted">วิดีโอพร้อม: {renderedPath}</span>}
          </div>

          <p className="muted">{project.script}</p>

          <div className="transcriptList">
            {project.scenes.map((scene) => (
              <div className="transcriptRow" key={scene.id}>
                <span>
                  ฉาก {String(scene.order).padStart(2, "0")} ·{" "}
                  {scene.estimatedDuration.toFixed(1)}s
                </span>
                <div>
                  <p>{scene.narration}</p>
                  <small>{scene.imagePrompt}</small>
                  {scene.videoPrompt && (
                    <div className="keyRow">
                      <button onClick={() => copyVideoPrompt(scene.id, scene.videoPrompt)}>
                        {copiedSceneId === scene.id ? "คัดลอกพรอมต์ Meta แล้ว ✓" : "คัดลอกพรอมต์วิดีโอ Meta"}
                      </button>
                      {project.assetPlan?.assets.some((asset) => asset.sceneId === scene.id && asset.kind === "video") ? (
                        <>
                          <span className="aiBadge readyBadge">วิดีโอ Meta พร้อม ✓</span>
                          <button onClick={() => importMetaVideoForScene(scene.id)}>เปลี่ยนวิดีโอ Meta</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => importMetaVideoForScene(scene.id)}>นำเข้าวิดีโอ Meta</button>
                          <span className="aiBadge">รอวิดีโอ Meta</span>
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
