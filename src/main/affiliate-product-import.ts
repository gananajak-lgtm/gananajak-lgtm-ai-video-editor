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
/**
 * Product URL slugs are a title hint, not verified seller metadata.
 * Shopee links commonly end with -i.<shopId>.<itemId>.
 */
export function productTitleFromUrl(sourceUrl:string):string|undefined {
  let url:URL;
  try { url=new URL(sourceUrl); } catch { return undefined; }
  if(detectAffiliatePlatform(sourceUrl)!=="shopee")return undefined;
  const last=url.pathname.split("/").filter(Boolean).at(-1);
  if(!last || !/-i\.\d+\.\d+$/.test(last))return undefined;
  const slug=last.replace(/-i\.\d+\.\d+$/,"");
  let text:string;
  try{text=decodeURIComponent(slug);}catch{return undefined;}
  return text.replace(/-/g," ").replace(/\s+/g," ").trim().slice(0,180)||undefined;
}
export function createAffiliateProduct(input:{sourceUrl:string;title?:string;imageUrls?:string[]}):AffiliateProduct{
  const sourceUrl=input.sourceUrl.trim(); if(!sourceUrl) throw new Error("Product URL is required.");
  return {id:`affiliate-product-${randomUUID()}`,platform:detectAffiliatePlatform(sourceUrl),sourceUrl,title:input.title?.trim()||productTitleFromUrl(sourceUrl)||"Imported product",imageUrls:input.imageUrls??[],importedAt:new Date().toISOString()};
}

/** Extract only publisher-provided public metadata; never infer a price from a URL. */
export function extractPublicProductMetadata(html:string,sourceUrl:string):Pick<AffiliateProduct,"title"|"imageUrls"|"description"|"sellerName"|"price"|"currency"> {
  const tags=Array.from(html.matchAll(/<meta\\b[^>]*>/gi),match=>match[0]);
  const attrs=(tag:string)=>Object.fromEntries(Array.from(tag.matchAll(/([\\w:-]+)\\s*=\\s*(?:"([^"]*)"|'([^']*)')/g),m=>[m[1].toLowerCase(),m[2]??m[3]]));
  const decoded=(text:string)=>text.replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&#(\\d+);/g,(_,n:string)=>String.fromCodePoint(Number(n))).trim();
  const meta=new Map<string,string>();
  for(const tag of tags){
    const a=attrs(tag),key=(a.property??a.name??"").toLowerCase();
    if(key&&a.content&&!meta.has(key))meta.set(key,decoded(a.content));
  }
  const imageUrls:Array<string>=[];
  const pushImage=(value:string|undefined)=>{
    if(!value)return;
    try{
      const url=new URL(value,sourceUrl);
      if(url.protocol==="https:"&&!url.username&&!url.password&&!url.port&& !/(^|\\.)localhost$/.test(url.hostname)&&!imageUrls.includes(url.toString()))
        imageUrls.push(url.toString());
    }catch{/* Ignore unusable metadata. */}
  };
  pushImage(meta.get("og:image:secure_url"));
  pushImage(meta.get("og:image"));
  pushImage(meta.get("twitter:image"));
  const title=meta.get("og:title")??meta.get("twitter:title")??productTitleFromUrl(sourceUrl)??"Imported product";
  const priceText=meta.get("product:price:amount")??meta.get("og:price:amount");
  const price=priceText&&/^\\d+(?:\\.\\d+)?$/.test(priceText)?Number(priceText):undefined;
  const currency=meta.get("product:price:currency")??meta.get("og:price:currency");
  return {title:title.slice(0,240),imageUrls:imageUrls.slice(0,12),description:meta.get("og:description")?.slice(0,2000),sellerName:meta.get("product:brand"),price:Number.isFinite(price)?price:undefined,currency};
}

/** Fetch only known storefront hosts; block redirects to arbitrary addresses and bound response size/time. */
export async function importAffiliateProductMetadata(sourceUrl:string,fetcher:typeof fetch=fetch):Promise<AffiliateProduct> {
  const base=createAffiliateProduct({sourceUrl});
  const MAX_HTML=2*1024*1024;
  let url=sourceUrl;
  try{
    for(let redirects=0;redirects<3;redirects++){
      const target=new URL(url);
      if(target.protocol!=="https:"||target.username||target.password||target.port||
         detectAffiliatePlatform(target.toString())!==base.platform)break;
      const response=await fetcher(target.toString(),{redirect:"manual",signal:AbortSignal.timeout(12_000),
        headers:{"Accept":"text/html","User-Agent":"Mozilla/5.0 (compatible; GananajakVideoEditor/1.0)"}});
      if(response.status>=300&&response.status<400){
        const location=response.headers.get("location");
        if(!location)break;
        url=new URL(location,target).toString();
        continue;
      }
      if(!response.ok||!response.body)break;
      if(Number(response.headers.get("content-length")??0)>MAX_HTML)break;
      const chunks:Uint8Array[]=[];let length=0;
      const reader=response.body.getReader();
      try{
        while(true){
          const {done,value}=await reader.read();
          if(done)break;
          length+=value.byteLength;
          if(length>MAX_HTML)throw new Error("Product page exceeds metadata read limit.");
          chunks.push(value);
        }
      }finally{await reader.cancel().catch(()=>{});}
      const body=new Uint8Array(length);let offset=0;
      for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.byteLength;}
      const metadata=extractPublicProductMetadata(new TextDecoder().decode(body),sourceUrl);
      return {...base,...metadata};
    }
  }catch{/* A product page may require JavaScript or authentication. Preserve the URL without fabricated facts. */}
  return base;
}
