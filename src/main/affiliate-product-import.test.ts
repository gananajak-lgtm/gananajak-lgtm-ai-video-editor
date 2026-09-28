import test from "node:test";
import assert from "node:assert/strict";
import { createAffiliateProduct, detectAffiliatePlatform, productTitleFromUrl } from "./affiliate-product-import";

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
