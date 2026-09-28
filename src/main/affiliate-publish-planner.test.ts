import test from "node:test";import assert from "node:assert/strict";import { assertAffiliateBinding,assertQueuedAffiliateBinding,buildAffiliatePublishPlan } from "./affiliate-publish-planner";import type { AffiliateContentJob } from "../shared/affiliate-factory";
const job:AffiliateContentJob={id:"j",status:"rendered",attachProduct:true,product:{id:"sku-42",platform:"tiktok-shop",sourceUrl:"https://shop.example/p/42",affiliateUrl:"https://aff.example/42",title:"พัดลมพกพา",price:299,currency:"THB",sellerName:"ร้านลมเย็น",imageUrls:[],importedAt:"2026-09-28T00:00:00Z"}};
const item:any={id:"i",brief:{topic:"x",format:"short",language:"th",targetDurationSeconds:30},status:"rendered",outputPath:"x.mp4"};
test("affiliate publish plan carries exact selected product binding",()=>{const plan=buildAffiliatePublishPlan(item,job);assert.equal(plan.affiliate?.productId,"sku-42");assert.equal(plan.affiliate?.affiliateUrl,"https://aff.example/42");assert.match(plan.caption??"",/พัดลมพกพา/);assert.equal(assertAffiliateBinding(plan,job),true);});
test("binding guard rejects a different affiliate link",()=>{const plan=buildAffiliatePublishPlan(item,job);plan.affiliate={...plan.affiliate!,affiliateUrl:"https://aff.example/wrong"};assert.throws(()=>assertAffiliateBinding(plan,job),/URL binding mismatch/);});

test("affiliate copy without a link does not claim a basket or attached link",()=>{const noLink:AffiliateContentJob={...job,product:{...job.product,affiliateUrl:undefined}};const plan=buildAffiliatePublishPlan(item,noLink);assert.match(plan.caption??"",/ตรวจสอบรายละเอียดสินค้าได้จากหน้าสินค้าของแพลตฟอร์ม/);assert.doesNotMatch(plan.caption??"",/ตะกร้า|ลิงก์ที่แนบไว้/);assert.equal((plan.hashtags??[]).includes("รีวิวสินค้า"),false);});

test("queued affiliate binding rejects wrong item, product and link before upload",()=>{
 const plan=buildAffiliatePublishPlan(item,job);
 const current:any={...item,publish:plan};
 const queued:any={id:"q",itemId:item.id,affiliate:{...plan.affiliate,attachProduct:false}};
 assert.equal(assertQueuedAffiliateBinding(queued,current),true);
 assert.throws(()=>assertQueuedAffiliateBinding({...queued,itemId:"another"},current),/mismatch/);
 assert.throws(()=>assertQueuedAffiliateBinding({...queued,affiliate:{...queued.affiliate,productId:"other"}},current),/binding differs/);
 assert.throws(()=>assertQueuedAffiliateBinding({...queued,affiliate:{...queued.affiliate,affiliateUrl:"https://aff.example/other"}},current),/binding differs/);
 assert.throws(()=>assertQueuedAffiliateBinding({...queued,affiliate:undefined},current),/binding differs/);
 assert.equal(assertQueuedAffiliateBinding({itemId:item.id} as any,{...item,publish:undefined} as any),true);
});
