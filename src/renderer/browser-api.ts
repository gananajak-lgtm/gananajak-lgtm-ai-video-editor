import type { DesktopApi, ProjectDocument, ProjectLoadResult } from "../shared/types";

const AUTOSAVE_KEY="gananajak.browser.autosave.v1";
const unsupported=(name:string)=>async()=>{throw new Error(`ฟังก์ชัน “${name}” ต้องใช้ Backend Worker ซึ่งกำลังเชื่อมเข้ากับเวอร์ชัน Browser`);};
const noopSubscribe=()=>()=>{};

function loadAutosave():ProjectLoadResult|null{
  const raw=localStorage.getItem(AUTOSAVE_KEY);
  if(!raw)return null;
  try{return {project:JSON.parse(raw) as ProjectDocument,filePath:null,missingMedia:[]};}
  catch{localStorage.removeItem(AUTOSAVE_KEY);return null;}
}

export function installBrowserApi(){
  if(window.videoEditor)return false;
  const base:Partial<DesktopApi>={
    getAiSettingsStatus:async()=>({configured:false,persistedSecurely:false}),
    getContentProviderStatus:async()=>({replicateConfigured:false,elevenLabsConfigured:false,affiliateVideoReady:false}),
    loadAutosaveProject:async()=>loadAutosave(),
    autosaveProject:async(project)=>{localStorage.setItem(AUTOSAVE_KEY,JSON.stringify(project));},
    getPublishAccounts:async()=>[],
    getMetaDestinations:async()=>[],
    loadPublishJobs:async()=>({jobs:[],updatedAt:new Date().toISOString()}),
    loadContentBatch:async()=>null,
    loadAffiliateQueue:async()=>({products:[],jobs:[],updatedAt:new Date().toISOString()}),
    getTikTokShopCreatorStatus:async()=>({connected:false,scopes:[]}),
    onPublishJobsUpdated:noopSubscribe,
    onContentBatchRenderProgress:noopSubscribe,
    onContentBatchAssetProgress:noopSubscribe,
    onContentBatchProgress:noopSubscribe,
    onContentAssetProgress:noopSubscribe,
    onRenderProgress:noopSubscribe,
    onQcPackProgress:noopSubscribe
  };
  window.videoEditor=new Proxy(base as DesktopApi,{
    get(target,property,receiver){
      const value=Reflect.get(target,property,receiver);
      return value??unsupported(String(property));
    }
  });
  return true;
}
