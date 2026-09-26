import { randomUUID } from "node:crypto";
import type { ContentBatchItem, PublishJob } from "../shared/content-factory";
import { validatePublishItem } from "./content-publish-validation";

export function createPublishJobs(item: ContentBatchItem, now = new Date()): PublishJob[] {
  const validation=validatePublishItem(item,now);
  if(!validation.valid) throw new Error(validation.issues.map((issue)=>issue.message).join(" · "));
  const createdAt=now.toISOString();
  return (item.publish?.platforms ?? []).map((platform)=>({
    id:randomUUID(), itemId:item.id, platform, status:item.publish?.scheduledAt && new Date(item.publish.scheduledAt).getTime() > now.getTime() ? "blocked" : "queued", scheduledAt:item.publish?.scheduledAt,
    attempts:0, createdAt, updatedAt:createdAt
  }));
}

export function releaseDuePublishJobs(jobs: PublishJob[], now = new Date()): PublishJob[] {
  const nowMs=now.getTime();
  return jobs.map((job)=>{
    if(job.status!=="blocked" || !job.scheduledAt) return job;
    const scheduledMs=new Date(job.scheduledAt).getTime();
    if(Number.isNaN(scheduledMs) || scheduledMs>nowMs) return job;
    return {...job,status:"queued",updatedAt:now.toISOString()};
  });
}

export function recoverInterruptedPublishJobs(jobs: PublishJob[], now = new Date()): PublishJob[] {
  return jobs.map((job)=>{ if(job.status!=="publishing") return job; if(job.platform==="tiktok" && job.externalPublishId) return {...job,status:"processing",error:"TikTok accepted this publish session. Check its status to continue.",updatedAt:now.toISOString()}; return {...job,status:"failed",error:`${job.platform} publishing was interrupted. Review the existing publish session before retrying to avoid a duplicate post.`,updatedAt:now.toISOString()}; });
}
