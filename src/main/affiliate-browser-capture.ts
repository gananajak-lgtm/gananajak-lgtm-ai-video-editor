import { BrowserWindow } from "electron";
import type { AffiliateProduct } from "../shared/affiliate-factory";
import { detectAffiliatePlatform, extractPublicProductMetadata } from "./affiliate-product-import";

export type BrowserProductSnapshot = {
  html: string;
  galleryImages: string[];
  pageTitle: string;
  blocked: boolean;
};
const CAPTURE_SCRIPT = `(() => {
  const meta = (key) => document.querySelector('meta[property="' + key + '"],meta[name="' + key + '"]')?.content || "";
  const markers = /(captcha|verify you are human|unusual traffic|robot verification|เข้าสู่ระบบเพื่อดำเนินการต่อ)/i;
  const blocked = markers.test(document.title) || markers.test((document.body?.innerText || "").slice(0,450));
  const images = [];
  const add = (value) => {
    if (typeof value !== "string" || !value) return;
    try { const u=new URL(value,location.href); if(u.protocol==="https:" && !images.includes(u.href))images.push(u.href); } catch {}
  };
  for (const selector of [
    '[class*="image-gallery"] img',
    '[class*="ImageGallery"] img',
    '[class*="product-image"] img',
    '[class*="ProductImage"] img',
    '[data-sqe="image"] img',
    '[class*="product-detail"] img'
  ]) {
    for (const element of document.querySelectorAll(selector)) {
      if (!element.complete || element.naturalWidth < 180 || element.naturalHeight < 180) continue;
      add(element.currentSrc || element.src);
      const raw=element.getAttribute("data-src");
      if(raw)add(raw);
    }
  }
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const walk = (data) => {
        if (Array.isArray(data)) {for (const item of data) walk(item);return;}
        if(!data || typeof data!=="object")return;
        const type=data["@type"];
        if(type==="Product" || (Array.isArray(type) && type.includes("Product"))) {
          const values=Array.isArray(data.image)?data.image:[data.image];
          for(const v of values) add(typeof v==="string"?v:v?.url);
        }
        if(data["@graph"])walk(data["@graph"]);
      };
      walk(JSON.parse(script.textContent || "null"));
    } catch {}
  }
  add(meta("og:image:secure_url"));add(meta("og:image"));
  return {html: document.head?.innerHTML?.slice(0, 500000) || "", galleryImages:images.slice(0,12),
    pageTitle:document.title || "", blocked};
})()`;

export function mergeBrowserProductMetadata(product:AffiliateProduct,snapshot:BrowserProductSnapshot):AffiliateProduct {
  const parsed=extractPublicProductMetadata(snapshot.html,product.sourceUrl);
  const allowed:string[]=[];
  for(const candidate of [...snapshot.galleryImages,...parsed.imageUrls]){
    try{
      const u=new URL(candidate);
      if(u.protocol!=="https:" || u.username || u.password || u.port || !u.hostname.includes(".") || allowed.includes(u.href))continue;
      allowed.push(u.href);
    }catch{/* Do not trust broken gallery URLs. */}
  }
  const title=parsed.title && parsed.title!=="Imported product"?parsed.title:product.title;
  return {...product,
    title,
    imageUrls:allowed.slice(0,12),
    description:parsed.description??product.description,
    price:parsed.price??product.price,
    currency:parsed.currency??product.currency
  };
}

/** A normal visible website session: no bypassing access controls or hidden marketplace APIs. */
export async function captureAffiliatePageInBrowser(product:AffiliateProduct, timeoutMs=60_000):Promise<AffiliateProduct> {
  if(detectAffiliatePlatform(product.sourceUrl)!==product.platform)throw new Error("Product platform mismatch.");
  const url=new URL(product.sourceUrl);
  if(url.protocol!=="https:" || url.username || url.password || url.port)
    throw new Error("Browser import only opens valid HTTPS product pages.");
  const window=new BrowserWindow({
    width:1100,height:840,show:true,title:"เลือกสินค้าจากหน้าเว็บ · Gananajak",
    webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}
  });
  window.webContents.setWindowOpenHandler(()=>({action:"deny"}));
  let closed=false;
  window.once("closed",()=>{closed=true;});
  try{
    await window.loadURL(url.toString());
    const end=Date.now()+timeoutMs;
    let last:BrowserProductSnapshot|null=null;
    while(!closed && Date.now()<end){
      await new Promise(resolve=>setTimeout(resolve,1500));
      if(closed)break;
      try{
        const current=new URL(window.webContents.getURL());
        // A page is never allowed to hand an unrelated shop's media to this product.
        if(current.protocol!=="https:" || detectAffiliatePlatform(current.toString())!==product.platform)continue;
        const snapshot=await window.webContents.executeJavaScript(CAPTURE_SCRIPT,true) as BrowserProductSnapshot;
        last=snapshot;
        const updated=mergeBrowserProductMetadata(product,snapshot);
        if(updated.imageUrls.length>0)return updated;
      }catch{/* The site may still be navigating or loading JavaScript. */}
    }
    if(closed)throw new Error("Product browser window was closed before photos were found.");
    throw new Error(last?.blocked
      ?"The storefront requested verification. Open the product in your normal browser or use the manual photo option."
      :"No product photos were exposed to the browser importer. The storefront may block embedded browsers.");
  }finally{
    if(!window.isDestroyed())window.close();
  }
}
