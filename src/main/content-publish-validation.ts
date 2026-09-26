import { existsSync } from "node:fs";
import type { ContentBatchItem, PublishPlatform } from "../shared/content-factory";
import { getPublishConnectorCapability } from "./content-publish-connectors";

export type PublishValidationIssue = { field: string; message: string; platform?: PublishPlatform };
export type PublishValidationResult = { valid: boolean; issues: PublishValidationIssue[] };

export function validatePublishItem(item: ContentBatchItem, now = new Date()): PublishValidationResult {
  const issues: PublishValidationIssue[] = [];
  const plan = item.publish;
  if (!item.outputPath) issues.push({ field:"outputPath", message:"Render the video before publishing." });
  else if (!existsSync(item.outputPath)) issues.push({ field:"outputPath", message:"Rendered video file cannot be found." });
  if (!plan) return { valid:false, issues:[...issues, { field:"publish", message:"Publish metadata has not been prepared." }] };
  const platforms = plan.platforms ?? [];
  if (!plan.title?.trim()) issues.push({ field:"title", message:"Add a title before publishing." });
  else if (platforms.includes("youtube") && plan.title.trim().length > 100) issues.push({ field:"title", message:"YouTube titles must be 100 characters or fewer.", platform:"youtube" });
  const youtubeDescription=[plan.description?.trim(), ...(plan.hashtags ?? []).map((tag)=>`#${tag.replace(/^#/, "")}`)].filter(Boolean).join("\\n\\n");
  if ((plan.platforms ?? []).includes("youtube") && youtubeDescription.length > 5000) issues.push({ field:"description", message:"YouTube descriptions must be 5000 characters or fewer.", platform:"youtube" });
  if (platforms.length === 0) issues.push({ field:"platforms", message:"Select at least one publishing platform." });
  for (const platform of platforms) {
    const capability = getPublishConnectorCapability(platform);
    if (!capability?.readyForIntegration) issues.push({ field:"platforms", platform, message:`${platform} publishing connector is not ready yet.` });
  }
  if (plan.status === "scheduled" || plan.scheduledAt) {
    const scheduled = plan.scheduledAt ? new Date(plan.scheduledAt) : undefined;
    if (!scheduled || Number.isNaN(scheduled.getTime())) issues.push({ field:"scheduledAt", message:"Choose a valid schedule date and time." });
    else if (scheduled.getTime() <= now.getTime()) issues.push({ field:"scheduledAt", message:"Scheduled publish time must be in the future." });
  }
  return { valid:issues.length === 0, issues };
}
