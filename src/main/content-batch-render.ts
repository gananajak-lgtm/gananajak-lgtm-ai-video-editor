import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { ContentBatch, ContentBatchItem } from "../shared/content-factory";
import { assembleNarrationAndTimeline } from "./content-narration-runner";
import { renderTimeline } from "./video/render";
import { verifyRenderedOutput } from "./video/renderVerification";

export type BatchRenderProgress = {
  completed: number;
  total: number;
  item: ContentBatchItem;
  renderProgress?: number;
};

function safeFileName(value:string) {
  const cleaned=value.normalize("NFKC").replace(/[<>:"/\\|?*\u0000-\u001F]/g," ").replace(/\s+/g," ").trim();
  return (cleaned || "video").slice(0,120);
}

export async function renderContentBatch(
  batch:ContentBatch,
  outputDir:string,
  workRoot:string,
  onProgress?:(progress:BatchRenderProgress)=>void
):Promise<ContentBatch>{
  await mkdir(outputDir,{recursive:true});
  const items=batch.items.map(item=>({...item}));
  const runnable=items.filter(item=>item.project && (item.status==="assets-ready" || item.status==="failed"));
  let completed=items.filter(item=>item.status==="rendered").length;
  const total=completed+runnable.length;
  for(const item of items){
    if(!item.project || item.status==="rendered" || (item.status!=="assets-ready" && item.status!=="failed")) continue;
    item.status="rendering"; item.error=undefined;
    onProgress?.({completed,total,item:{...item},renderProgress:0});
    try{
      const workDir=path.join(workRoot,item.project.id);
      const assembled=await assembleNarrationAndTimeline(item.project,workDir);
      const outputPath=path.join(outputDir,`${safeFileName(item.project.title)}-${item.project.id.slice(-8)}.mp4`);
      const rendered=await renderTimeline(assembled.timeline,outputPath,(progress)=>{
        onProgress?.({completed,total,item:{...item},renderProgress:Math.max(0,Math.min(1,progress.progress))});
      });
      const report=await verifyRenderedOutput(assembled.timeline,rendered);
      if(!report.passed) throw new Error(report.diagnostics.filter(d=>d.level==="error").map(d=>d.message).join("; ") || "Rendered output failed verification.");
      item.status="rendered"; item.outputPath=rendered;
    }catch(error){
      item.status="failed"; item.error=error instanceof Error?error.message:String(error); item.failedStage="render";
    }
    completed+=1;
    onProgress?.({completed,total,item:{...item},renderProgress:item.status==="rendered"?1:undefined});
  }
  return {...batch,items,updatedAt:new Date().toISOString()};
}
