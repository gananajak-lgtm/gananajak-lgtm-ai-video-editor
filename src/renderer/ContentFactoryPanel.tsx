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
  const [affiliateLocalRunning, setAffiliateLocalRunning] = useState(false);
  const [affiliateImportErrors, setAffiliateImportErrors] = useState<string[]>([]);

  useEffect(() => {
    void window.videoEditor.getContentProviderStatus().then(setProviderStatus);
    void window.videoEditor.loadContentBatch().then((saved) => { if (saved) setBatch(saved); });
    void window.videoEditor.getPublishAccounts().then(setPublishAccounts);
    void window.videoEditor.loadAffiliateQueue().then((saved) => { setAffiliateProducts(saved.products); setAffiliateJobs(saved.jobs); });
  }, []);

  const importAffiliateProducts = async () => {
    const urls=affiliateUrls.split(/\\r?\
/).map((value)=>value.trim()).filter(Boolean).slice(0,100);
    if (!urls.length || affiliateImporting) return;
    setAffiliateImporting(true); setError(null); setAffiliateImportErrors([]);
    try {
      const products:AffiliateProduct[]=[]; const failures:string[]=[];
      for (const url of urls) { try { products.push(await window.videoEditor.importAffiliateProduct(url)); } catch(importError) { failures.push(`${url}: ${importError instanceof Error ? importError.message : String(importError)}`); } }
      const jobs=await window.videoEditor.createAffiliateJobs(products);
      setAffiliateProducts(products); setAffiliateJobs(jobs); setAffiliateImportErrors(failures);
      await window.videoEditor.saveAffiliateQueue(products,jobs);
      if(!products.length && failures.length) setError("No valid affiliate products were imported.");
    } catch (importError) { setError(importError instanceof Error ? importError.message : String(importError)); }
    finally { setAffiliateImporting(false); }
  };

  const createLocalAffiliateVideos = async () => {
    if(!affiliateJobs.length || affiliateLocalRunning) return;
    const outputDir=await window.videoEditor.chooseBatchOutputFolder(); if(!outputDir) return;
    setAffiliateLocalRunning(true); setError(null); setBatchProgress({completed:0,total:affiliateJobs.length});
    const unsubscribe=window.videoEditor.onContentBatchProgress((progress)=>setBatchProgress({completed:progress.completed,total:progress.total}));
    try { setBatch(await window.videoEditor.createLocalAffiliateBatch(affiliateJobs,outputDir,language,Math.max(10,duration))); }
    catch(localError){setError(localError instanceof Error?localError.message:String(localError));}
    finally{unsubscribe();setAffiliateLocalRunning(false);}
  };
