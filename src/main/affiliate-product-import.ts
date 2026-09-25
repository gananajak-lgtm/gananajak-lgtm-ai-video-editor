import type { AffiliatePlatform, AffiliateProduct } from "../shared/affiliate-factory";

export function detectAffiliatePlatform(sourceUrl:string):AffiliatePlatform {
  const host=new URL(sourceUrl).hostname.toLowerCase();
  if (host.includes("shopee")) return "shopee";
  if (host.includes("lazada")) return "lazada";
  if (host.includes("tiktok")) return "tiktok-shop";
  throw new Error("Unsupported affiliate product URL.");
}

export function createAffiliateProduct(input:{ sourceUrl:string; title?:string; imageUrls?:string[] }):AffiliateProduct {
  const sourceUrl=input.sourceUrl.trim();
  if (!sourceUrl) throw new Error("Product URL is required.");
  return {
    id:`affiliate-product-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    platform:detectAffiliatePlatform(sourceUrl),
    sourceUrl,
    title:input.title?.trim() || "Imported product",
    imageUrls:input.imageUrls ?? [],
    importedAt:new Date().toISOString()
  };
}
