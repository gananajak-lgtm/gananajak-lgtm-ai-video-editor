import { affiliateProductToTopic } from "./affiliate-content-jobs";
import { buildAffiliateCreativePrompt } from "./affiliate-creative-planner";
import type { AffiliateContentJob } from "../shared/affiliate-factory";
import type { ContentBrief } from "../shared/content-factory";

export function affiliateJobToContentBrief(job:AffiliateContentJob, options?:{language?:"th"|"en";duration?:number}):ContentBrief {
  return {
    topic:`${affiliateProductToTopic(job.product)}\n\n${buildAffiliateCreativePrompt(job.product)}`,
    format:"short",
    language:options?.language ?? "th",
    targetDurationSeconds:options?.duration ?? 30,
    tone:"clear product demonstration with a concise affiliate call to action",
    audience:"online shoppers"
  };
}
