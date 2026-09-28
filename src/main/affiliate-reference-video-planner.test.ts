import { referenceVideoInput, validateReplicateModel, validateReplicateVideoUrl } from "./providers/replicate-reference-video-provider";
import test from "node:test";import assert from "node:assert/strict";import { buildAffiliateReferenceVideoPlan } from "./affiliate-reference-video-planner";
test("affiliate video jobs use the real product image as reference",()=>{const product:any={id:"p",platform:"shopee",sourceUrl:"https://shopee.co.th/x",title:"พัดลมพกพา",imageUrls:["https://img.example/x.jpg"],importedAt:"x"};const project:any={id:"pr",scenes:[{id:"s1",order:1,narration:"x",visualIntent:"ถือสินค้า",imagePrompt:"x",videoPrompt:"มือหยิบสินค้า",sfxHints:[],estimatedDuration:5}]};const image:any={id:"real-image",projectId:"pr",sceneId:"s1",kind:"image",filePath:"/tmp/product.jpg",provider:"affiliate-product",source:"imported"};const plan=buildAffiliateReferenceVideoPlan(product,project,[image]);assert.equal(plan.jobs[0].kind,"video");assert.equal(plan.jobs[0].referenceAssetId,"real-image");assert.equal(plan.jobs[0].referenceImagePath,"/tmp/product.jpg");assert.match(plan.jobs[0].prompt,/not a still-image zoom or pan/);assert.match(plan.jobs[0].prompt,/Preserve the product shape/);});

test("Kling preset sends the reference image using its documented start_image schema",()=>{
 const input=referenceVideoInput("kwaivgi/kling-v2.1","a product rotating","data:image/png;base64,AAA");
 assert.deepEqual(input,{prompt:"a product rotating",start_image:"data:image/png;base64,AAA",duration:5});
 assert.equal("image" in input,false);
});
test("generic reference video input retains the legacy image schema",()=>{
 const input=referenceVideoInput("owner/model","movement","data:image/png;base64,BBB");
 assert.deepEqual(input,{prompt:"movement",image:"data:image/png;base64,BBB",aspect_ratio:"9:16"});
});

test("reference video model identifiers reject injected paths and URLs",()=>{
 assert.equal(validateReplicateModel("kwaivgi/kling-v2.1"),"kwaivgi/kling-v2.1");
 for(const model of ["bad","owner/model/extra","owner/../model","https://example.com/model","owner/model?x=1"]) {
  assert.throws(()=>validateReplicateModel(model),/owner\/model/);
 }
});
test("video downloads accept only trusted HTTPS delivery hosts",()=>{
 assert.equal(validateReplicateVideoUrl("https://replicate.delivery/pbxt/test.mp4").hostname,"replicate.delivery");
 for(const url of ["http://replicate.delivery/a.mp4","https://replicate.delivery.evil.test/a.mp4","https://localhost/a.mp4","https://user:pass@replicate.delivery/a.mp4"]) {
  assert.throws(()=>validateReplicateVideoUrl(url),/HTTPS|approved/);
 }
});
