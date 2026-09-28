import type { AffiliateContentJob } from "../shared/affiliate-factory";import type { ContentBatchItem } from "../shared/content-factory";import { AFFILIATE_CONNECTOR_CAPABILITIES } from "./affiliate-platform-capabilities";import { validatePublishItem } from "./content-publish-validation";import { assertAffiliateBinding } from "./affiliate-publish-planner";

export type AffiliatePublishReadiness={video:{ready:boolean;issues:string[]};productAttachment:{ready:boolean;status:"verified"|"unverified"|"not-requested";issues:string[]}};

export function getAffiliatePublishReadiness(item:ContentBatchItem,job:AffiliateContentJob,now=new Date()):AffiliatePublishReadiness{
  const validation=validatePublishItem(item,now);const videoIssues=validation.issues.map(x=>x.message);
  try{if(item.publish)assertAffiliateBinding(item.publish,job);else videoIssues.push("Affiliate publish metadata has not been prepared.");}catch(error){videoIssues.push(error instanceof Error?error.message:String(error));}
  const capability=AFFILIATE_CONNECTOR_CAPABILITIES.find(x=>x.platform===job.product.platform);
  const requested=job.attachProduct;
  const attachmentIssues:string[]=[];
  if(requested&&!item.publish?.affiliate?.affiliateUrl)attachmentIssues.push("Affiliate link is not available for the selected product.");
  if(requested&&capability?.productAttachment!=="verified")attachmentIssues.push("Automatic product attachment is not verified for this platform connector.");
  return {video:{ready:videoIssues.length===0,issues:Array.from(new Set(videoIssues))},productAttachment:{ready:!requested||(attachmentIssues.length===0&&capability?.productAttachment==="verified"),status:requested?(capability?.productAttachment==="verified"?"verified":"unverified"):"not-requested",issues:attachmentIssues}};
}
