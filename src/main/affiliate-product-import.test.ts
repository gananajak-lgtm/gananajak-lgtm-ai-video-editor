import test from "node:test";
import assert from "node:assert/strict";
import { detectAffiliatePlatform } from "./affiliate-product-import";

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
