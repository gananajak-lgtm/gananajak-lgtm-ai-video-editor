import { createHmac } from "node:crypto";
import { randomUUID } from "node:crypto";
import type { AffiliateExternalSearchProvider } from "./affiliate-product-search-service";
import type { AffiliateProduct } from "../shared/affiliate-factory";

export type TikTokShopCreatorCredentials={appKey:string;appSecret:string;accessToken:string};
type ShowcaseProduct={id?:string;product_id?:string;title?:string;name?:string;product_name?:string;product_url?:string;affiliate_url?:string;image?:{url?:string};images?:Array<{url?:string}>;price?:{amount?:string;currency?:string};seller?:{name?:string};shop?:{name?:string}};

export function signTikTokShopRequest(input:{path:string;query:URLSearchParams;appSecret:string}){
  const entries=[...input.query.entries()].filter(([key])=>key!=="sign"&&key!=="access_token").sort(([a],[b])=>a.localeCompare(b));
  const canonical=input.path+entries.map(([key,value])=>key+value).join("");
  return createHmac("sha256",input.appSecret).update(input.appSecret+canonical+input.appSecret).digest("hex");
}

function normalizeProduct(raw:ShowcaseProduct):AffiliateProduct|null{
  const title=(raw.title||raw.product_name||raw.name||"").trim();
  const productId=raw.product_id||raw.id;
  if(!title||!productId)return null;
  const amount=Number(raw.price?.amount);
  const imageUrls=[...(raw.images??[]).map((item)=>item.url).filter((value):value is string=>Boolean(value)),raw.image?.url].filter((value):value is string=>Boolean(value));
  return {id:`tiktok-shop-${productId}-${randomUUID()}`,platform:"tiktok-shop",sourceUrl:raw.product_url||raw.affiliate_url||`https://www.tiktok.com/shop`,title,price:Number.isFinite(amount)?amount:undefined,currency:raw.price?.currency,imageUrls,affiliateUrl:raw.affiliate_url,sellerName:raw.seller?.name||raw.shop?.name,importedAt:new Date().toISOString()};
}

export function createTikTokShopShowcaseProvider(loadCredentials:()=>Promise<TikTokShopCreatorCredentials|null>):AffiliateExternalSearchProvider{
  return {id:"tiktok-shop-showcase",label:"TikTok Shop Showcase",configured:async()=>Boolean(await loadCredentials()),search:async(query,limit)=>{
    const credentials=await loadCredentials();if(!credentials)return [];
    const path="/affiliate_creator/202405/showcases/products";
    const params=new URLSearchParams({app_key:credentials.appKey,page_size:String(Math.min(50,Math.max(1,limit))),timestamp:String(Math.floor(Date.now()/1000))});
    params.set("sign",signTikTokShopRequest({path,query:params,appSecret:credentials.appSecret}));
    const response=await fetch(`https://open-api.tiktokglobalshop.com${path}?${params}`,{headers:{"content-type":"application/json","x-tts-access-token":credentials.accessToken}});
    const payload=await response.json() as {code?:number;message?:string;data?:{products?:ShowcaseProduct[]}};
    if(!response.ok||payload.code!==0)throw new Error(payload.message||"TikTok Shop Showcase search failed.");
    const needle=query.trim().toLocaleLowerCase();
    return (payload.data?.products??[]).map(normalizeProduct).filter((product):product is AffiliateProduct=>Boolean(product)).filter((product)=>!needle||product.title.toLocaleLowerCase().includes(needle)||product.sellerName?.toLocaleLowerCase().includes(needle)).slice(0,limit);
  }};
}
