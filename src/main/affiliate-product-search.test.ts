import assert from "node:assert/strict";
import { explainAffiliateProduct, searchAffiliateCatalog } from "./affiliate-product-search";
import type { AffiliateProduct } from "../shared/affiliate-factory";

const now=new Date().toISOString();
const products:AffiliateProduct[]=[
 {id:"a",platform:"lazada",sourceUrl:"https://lazada.co.th/a",title:"เครื่องดูดฝุ่นไร้สาย Pro",sellerName:"Clean Home",description:"แรงดูดสูง",rating:4.9,soldCount:1200,imageUrls:[],importedAt:now},
 {id:"b",platform:"shopee",sourceUrl:"https://shopee.co.th/b",title:"แปรงทำความสะอาด",sellerName:"เครื่องดูดฝุ่นไทย",description:"อุปกรณ์ในบ้าน",rating:4.8,soldCount:900,imageUrls:[],importedAt:now},
 {id:"c",platform:"tiktok-shop",sourceUrl:"https://tiktok.com/c",title:"โคมไฟตั้งโต๊ะ",sellerName:"Light Shop",imageUrls:[],importedAt:now}
];
const exact=searchAffiliateCatalog(products,"เครื่องดูดฝุ่นไร้สาย");
assert.equal(exact.products[0]?.id,"a");
assert.equal(exact.products.some((p)=>p.id==="c"),false);
const seller=searchAffiliateCatalog(products,"clean home");
assert.deepEqual(seller.products.map((p)=>p.id),["a"]);
assert.equal(searchAffiliateCatalog(products,"ไม่มีสินค้านี้").products.length,0);
assert.equal(searchAffiliateCatalog(products,"").products.length,3);
console.log("affiliate product search tests passed");

const rankedSignals=searchAffiliateCatalog([{...products[0],id:"weak",title:"เครื่องดูดฝุ่น",rating:2,soldCount:1},{...products[0],id:"strong",title:"เครื่องดูดฝุ่น",rating:5,soldCount:1000}], "เครื่องดูดฝุ่น", 10);
assert.equal(rankedSignals.products[0]?.id,"strong");
const relevanceWins=searchAffiliateCatalog([{...products[0],id:"exact",title:"เครื่องดูดฝุ่น",rating:1,soldCount:0},{...products[0],id:"seller",title:"ของใช้ในบ้าน",sellerName:"ร้านเครื่องดูดฝุ่น",rating:5,soldCount:999999}], "เครื่องดูดฝุ่น", 10);
assert.equal(relevanceWins.products[0]?.id,"exact");

assert.deepEqual(explainAffiliateProduct({...products[0],commissionRate:0.12},"เครื่องดูดฝุ่นไร้สาย"),["ตรงคำค้นมาก","เรตติ้งสูง","ยอดขายสูง"]);
assert.deepEqual(explainAffiliateProduct({...products[2],rating:undefined,soldCount:undefined,commissionRate:undefined},"โคมไฟ"),["ตรงคำค้น"]);
