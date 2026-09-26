import { randomUUID } from "node:crypto";
import type { ContentBatchItem, PublishJob } from "../shared/content-factory";
import { validatePublishItem } from "./content-publish-validation";

export function createPublishJobs(item: ContentBatchItem, now = new Date()): PublishJob[] {
  const validation=validatePublishItem(item,now);
  if(!validation.valid) throw new Error(validation.issues.map((issue)=>issue.message).join(" · "));
  const createdAt=now.toISOString();
  return (item.publish?.platforms ?? []).map((platform)=>({
    id:randomUUID(), itemId:item.id, platform, status:"queued", scheduledAt:item.publish?.scheduledAt,
    attempts:0, createdAt, updatedAt:createdAt
  }));
}
