import test from "node:test";
import assert from "node:assert/strict";
import { createAffiliateProduct, detectAffiliatePlatform, productTitleFromUrl, extractPublicProductMetadata, importAffiliateProductMetadata } from "./affiliate-product-import";

test("detects supported affiliate product hosts",()=>{
  assert.equal(detectAffiliatePlatform("https://shopee.co.th/product/1/2"),"shopee");
  assert.equal(detectAffiliatePlatform("https://www.lazada.co.th/products/example.html"),"lazada");
  assert.equal(detectAffiliatePlatform("https://www.tiktok.com/view/product/123"),"tiktok-shop");
});
test("accepts legitimate subdomains",()=>assert.equal(detectAffiliatePlatform("https://seller.shopee.co.th/product/1"),"shopee"));
test("rejects lookalike domains",()=>{
  assert.throws(()=>detectAffiliatePlatform("https://shopee.co.th.evil.example/product/1"),/Unsupported/);
  assert.throws(()=>detectAffiliatePlatform("https://fake-lazada.co.th/product/1"),/Unsupported/);
});
test("rejects invalid and unsafe URLs",()=>{
  assert.throws(()=>detectAffiliatePlatform("not a url"),/Invalid/);
  assert.throws(()=>detectAffiliatePlatform("javascript:alert(1)"),/HTTP or HTTPS/);
});

test("Shopee URL slug supplies a readable title without claiming scraped metadata",()=>{
 const url="https://shopee.co.th/Kito-%E0%B8%81%E0%B8%B5%E0%B9%82%E0%B8%95%E0%B9%89-%E0%B8%A3%E0%B8%AD%E0%B8%87%E0%B9%80%E0%B8%97%E0%B9%89%E0%B8%B2%E0%B9%81%E0%B8%95%E0%B8%B0-%E0%B8%A3%E0%B8%B8%E0%B9%88%E0%B8%99-AH98-Size-32-45-i.34539611.9960112012?extraParams=test";
 assert.equal(productTitleFromUrl(url),"Kito กีโต้ รองเท้าแตะ รุ่น AH98 Size 32 45");
 const product=createAffiliateProduct({sourceUrl:url});
 assert.equal(product.title,productTitleFromUrl(url));
 assert.deepEqual(product.imageUrls,[]);
});
test("unsupported slug formats keep the generic imported product label",()=>{
 assert.equal(productTitleFromUrl("https://shopee.co.th/product/123/456"),undefined);
 assert.equal(createAffiliateProduct({sourceUrl:"https://shopee.co.th/product/123/456"}).title,"Imported product");
});

test("imports storefront Open Graph title, image and explicitly declared price",async()=>{
 const html='<html><head><meta property="og:title" content="Kito AH98"/><meta property="og:image" content="https://cf.shopee.co.th/file/kito.jpg"/><meta property="product:price:amount" content="159"/><meta property="product:price:currency" content="THB"/></head></html>';
 const mock=async()=>new Response(html,{headers:{"content-type":"text/html"}});
 const p=await importAffiliateProductMetadata("https://shopee.co.th/Kito-i.1.2",mock as typeof fetch);
 assert.equal(p.title,"Kito AH98");
 assert.deepEqual(p.imageUrls,["https://cf.shopee.co.th/file/kito.jpg"]);
 assert.equal(p.price,159);
 assert.equal(p.currency,"THB");
});
test("storefront blocked response leaves URL-derived title without fictional image or price",async()=>{
 const denied=async()=>new Response("denied",{status:403});
 const product=await importAffiliateProductMetadata("https://shopee.co.th/Kito-Sandal-i.1.2",denied as typeof fetch);
 assert.equal(product.title,"Kito Sandal");
 assert.deepEqual(product.imageUrls,[]);
 assert.equal(product.price,undefined);
});
test("redirects cannot move public product import to an unrelated host",async()=>{
 let calls=0;
 const mock=async()=>{calls++;return new Response(null,{status:302,headers:{location:"https://private.example.com/internal"}});};
 const product=await importAffiliateProductMetadata("https://shopee.co.th/Kito-i.1.2",mock as typeof fetch);
 assert.equal(calls,1);
 assert.deepEqual(product.imageUrls,[]);
});
test("parser ignores non-HTTPS images",()=>{
 const m=extractPublicProductMetadata('<meta property="og:image" content="http://example.com/photo.jpg">',"https://shopee.co.th/Kito-i.1.2");
 assert.deepEqual(m.imageUrls,[]);
});
