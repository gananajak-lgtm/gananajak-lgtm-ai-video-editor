import type { AffiliateContentJob } from "../shared/affiliate-factory";import type { ContentBatchItem,PublishPlan } from "../shared/content-factory";import { buildPublishPlan } from "./content-publish-planner";

function hashtags(job:AffiliateContentJob){return Array.from(new Set([job.product.platform==="tiktok-shop"?"TikTokShop":"สินค้าแนะนำ","ช้อปออนไลน์"]));}

export function buildAffiliatePublishPlan(item:ContentBatchItem,job:AffiliateContentJob):PublishPlan{
  const base=buildPublishPlan(item),p=job.product;
  const price=p.price!=null?` ราคา ${p.price.toLocaleString()} ${p.currency??""}`.trim():"";
  const cta=p.affiliateUrl?"ดูรายละเอียดสินค้าได้จากลิงก์ที่แนบไว้":"ตรวจสอบรายละเอียดสินค้าได้จากหน้าสินค้าของแพลตฟอร์ม";
  const caption=`${p.title}${price ? ` · ${price}`:""}\n${cta}`;
  return {...base,title:p.title,caption,description:`${caption}\n\n${p.sellerName?`ร้าน: ${p.sellerName}\n`:""}ข้อมูลสินค้าอ้างอิงจากรายการสินค้าที่เลือกใน Gananajak AI Content Factory`,hashtags:hashtags(job),affiliate:{productId:p.id,platform:p.platform,sourceUrl:p.sourceUrl,affiliateUrl:p.affiliateUrl,sellerName:p.sellerName,attachProduct:job.attachProduct}};
}

export function assertAffiliateBinding(plan:PublishPlan,job:AffiliateContentJob){
  const binding=plan.affiliate;if(!binding)throw new Error("Affiliate publish plan is missing product binding.");
  if(binding.productId!==job.product.id||binding.platform!==job.product.platform||binding.sourceUrl!==job.product.sourceUrl)throw new Error("Affiliate product binding mismatch. Refusing to publish the wrong product.");
  if((binding.affiliateUrl??"")!==(job.product.affiliateUrl??""))throw new Error("Affiliate URL binding mismatch. Refusing to publish the wrong product link.");
  return true;
}

/** Refuse publishing when the queued affiliate binding and the current video disagree. */
export function assertQueuedAffiliateBinding(
  queued: import("../shared/content-factory").PublishJob,
  item: ContentBatchItem
): true {
  if (queued.itemId !== item.id) {
    throw new Error("Publish job and video item mismatch. Refusing to publish.");
  }
  const stored = queued.affiliate;
  const current = item.publish?.affiliate;
  if (!stored && !current) return true;
  if (!stored || !current ||
    stored.productId !== current.productId ||
    stored.platform !== current.platform ||
    stored.sourceUrl !== current.sourceUrl ||
    (stored.affiliateUrl ?? "") !== (current.affiliateUrl ?? "")) {
    throw new Error("Queued affiliate product binding differs from the current video. Refusing to publish.");
  }
  if (stored.attachProduct && !current.attachProduct) {
    throw new Error("Queued product attachment is no longer requested. Refusing to publish.");
  }
  return true;
}
