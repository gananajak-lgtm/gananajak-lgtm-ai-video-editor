import type { AffiliateContentJob } from "../shared/affiliate-factory";import type { ContentBatchItem,PublishJob } from "../shared/content-factory";import { getAffiliatePublishReadiness } from "./affiliate-publish-readiness";import { createPublishJobs } from "./content-publish-jobs";

export function createAffiliateVideoPublishJobs(item:ContentBatchItem,job:AffiliateContentJob,now=new Date()):PublishJob[]{
  const readiness=getAffiliatePublishReadiness(item,job,now);
  if(!readiness.video.ready)throw new Error(readiness.video.issues.join(" · ")||"Affiliate video is not ready to publish.");
  const publishJobs=createPublishJobs(item,now);
  return publishJobs.map(publishJob=>({...publishJob,affiliate:publishJob.affiliate?{...publishJob.affiliate,attachProduct:readiness.productAttachment.ready&&publishJob.affiliate.attachProduct}:undefined}));
}
