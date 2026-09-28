import assert from "node:assert/strict";
import { searchAffiliateProducts } from "./affiliate-product-search-service";
import type { AffiliateProduct } from "../shared/affiliate-factory";

const now=new Date().toISOString();
const local:AffiliateProduct={id:"local",platform:"shopee",sourceUrl:"https://shopee.co.th/item/1",title:"พัดลมพกพา",imageUrls:[],importedAt:now};
const external:AffiliateProduct={id:"external",platform:"tiktok-shop",sourceUrl:"https://tiktok.com/shop/item/2",title:"พัดลมพกพา Turbo",sellerName:"Turbo Shop",imageUrls:[],importedAt:now};
async function main(){
const result=await searchAffiliateProducts({catalog:[local],query:"พัดลม",providers:[{id:"mock",label:"Mock provider",configured:async()=>true,search:async()=>[external]}]});
assert.equal(result.source,"catalog+external");
assert.deepEqual(result.products.map((p)=>p.id),["external","local"]);
assert.equal(result.providers[0]?.count,1);
const unavailable=await searchAffiliateProducts({catalog:[local],query:"พัดลม",providers:[{id:"off",label:"Off",configured:async()=>false,search:async()=>{throw new Error("must not run");}}]});
assert.equal(unavailable.source,"catalog");
assert.equal(unavailable.providers[0]?.configured,false);
console.log("affiliate search service tests passed");
}
void main();
