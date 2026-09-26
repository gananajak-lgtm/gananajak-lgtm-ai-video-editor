import { affiliateProductToTopic } from "./affiliate-content-jobs";
import type { AffiliateContentJob } from "../shared/affiliate-factory";
import type { ContentBrief } from "../shared/content-factory";

export function affiliateJobToContentBrief(job:AffiliateContentJob, options?:{language?:"th"|"en";duration?:number}):ContentBrief {
  return {
    topic:affiliateProductToTopic(job.product),
    format:"short",
    language:options?.language ?? "th",
    targetDurationSeconds:options?.duration ?? 30,
    tone:"clear product demonstration with a concise affiliate call to action",
    audience:"online shoppers"
  };
}
