import { randomUUID } from "node:crypto";
import type { AffiliatePlatform, AffiliateProduct } from "../shared/affiliate-factory";

const PLATFORM_HOSTS:Record<AffiliatePlatform,string[]>={
  shopee:["shopee.co.th","shopee.com"],
  lazada:["lazada.co.th","lazada.com"],
  "tiktok-shop":["tiktok.com"]
};
function matchesHost(host:string,allowed:string){return host===allowed || host.endsWith(`.${allowed}`);}
export function detectAffiliatePlatform(sourceUrl:string):AffiliatePlatform{
  let url:URL; try{url=new URL(sourceUrl);}catch{throw new Error("Invalid affiliate product URL.");}
  if(url.protocol!=="https:" && url.protocol!=="http:") throw new Error("Affiliate product URL must use HTTP or HTTPS.");
  const host=url.hostname.toLowerCase();
  for(const [platform,hosts] of Object.entries(PLATFORM_HOSTS) as [AffiliatePlatform,string[]][]){if(hosts.some((allowed)=>matchesHost(host,allowed))) return platform;}
  throw new Error("Unsupported affiliate product URL.");
}
export function createAffiliateProduct(input:{sourceUrl:string;title?:string;imageUrls?:string[]}):AffiliateProduct{
  const sourceUrl=input.sourceUrl.trim(); if(!sourceUrl) throw new Error("Product URL is required.");
  return {id:`affiliate-product-${randomUUID()}`,platform:detectAffiliatePlatform(sourceUrl),sourceUrl,title:input.title?.trim()||"Imported product",imageUrls:input.imageUrls??[],importedAt:new Date().toISOString()};
}
