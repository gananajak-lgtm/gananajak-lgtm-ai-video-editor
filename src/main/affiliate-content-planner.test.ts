import test from "node:test";
import assert from "node:assert/strict";
import { affiliateJobToContentBrief } from "./affiliate-content-planner";

const job:any={id:"j1",status:"imported",attachProduct:true,product:{id:"p1",platform:"shopee",sourceUrl:"https://shopee.co.th/x",title:"Mini fan",price:299,currency:"THB",imageUrls:[],importedAt:"2026-09-25T00:00:00Z"}};

test("affiliate content planner uses verified product facts and short format",()=>{
  const brief=affiliateJobToContentBrief(job);
  assert.equal(brief.format,"short");
  assert.match(brief.topic,/Mini fan/);
  assert.match(brief.topic,/299 THB/);
  assert.match(brief.topic,/Do not invent/);
});
