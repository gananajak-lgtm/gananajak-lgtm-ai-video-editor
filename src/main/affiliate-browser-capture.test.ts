import test from "node:test";
import assert from "node:assert/strict";
import { createAffiliateProduct } from "./affiliate-product-import";
import { mergeBrowserProductMetadata } from "./affiliate-browser-capture";

test("browser import copies displayed product gallery image URLs onto same product identity",()=>{
  const p=createAffiliateProduct({sourceUrl:"https://shopee.co.th/Kito-AH98-i.34539611.9960112012"});
  const x=mergeBrowserProductMetadata(p,{
    html:'<meta property="og:title" content="Kito AH98 Official"><meta property="og:image" content="https://cf.shopee.co.th/file/hero.jpg">',
    galleryImages:["https://cf.shopee.co.th/file/front.jpg","https://cf.shopee.co.th/file/back.jpg"],
    pageTitle:"Kito AH98 Official",blocked:false
  });
  assert.equal(x.id,p.id);
  assert.equal(x.title,"Kito AH98 Official");
  assert.deepEqual(x.imageUrls,["https://cf.shopee.co.th/file/front.jpg","https://cf.shopee.co.th/file/back.jpg","https://cf.shopee.co.th/file/hero.jpg"]);
});
test("browser result rejects unsafe gallery URLs without inventing seller or price",()=>{
 const p=createAffiliateProduct({sourceUrl:"https://shopee.co.th/Kito-AH98-i.1.2"});
 const x=mergeBrowserProductMetadata(p,{
   html:'<meta property="og:image" content="http://unsafe.example.com/p.jpg">',
   galleryImages:["javascript:alert(1)","http://localhost/a","https://user:password@images.example.org/photo.jpg"],
   pageTitle:"",blocked:false
 });
 assert.deepEqual(x.imageUrls,[]);
 assert.equal(x.price,undefined);
 assert.equal(x.sellerName,undefined);
});
