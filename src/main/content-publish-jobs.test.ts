import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { ContentBatchItem } from "../shared/content-factory";
import { createPublishJobs, recoverInterruptedPublishJobs, releaseDuePublishJobs } from "./content-publish-jobs";

function rendered():ContentBatchItem { const dir=mkdtempSync(join(tmpdir(),"publish-job-")); const outputPath=join(dir,"video.mp4"); writeFileSync(outputPath,"x"); return {id:"item",status:"rendered",outputPath,brief:{topic:"Topic",format:"short",language:"en",targetDurationSeconds:30},publish:{status:"ready",title:"Title",platforms:["youtube","tiktok"]}}; }
test("creates one queued job per supported platform",()=>{const jobs=createPublishJobs(rendered(),new Date("2026-09-26T00:00:00Z"));assert.equal(jobs.length,2);assert.deepEqual(jobs.map(x=>x.platform),["youtube","tiktok"]);assert.ok(jobs.every(x=>x.status==="queued"&&x.attempts===0));});
test("blocks invalid publish items",()=>{const item=rendered();item.publish={status:"ready",title:"Title",platforms:["instagram"]};assert.throws(()=>createPublishJobs(item),/not ready/i);});

test("future scheduled jobs stay blocked until due",()=>{const item=rendered();item.publish={status:"scheduled",title:"Title",platforms:["youtube"],scheduledAt:"2026-09-27T00:00:00Z"};const jobs=createPublishJobs(item,new Date("2026-09-26T00:00:00Z"));assert.equal(jobs[0]?.status,"blocked");assert.equal(jobs[0]?.scheduledAt,"2026-09-27T00:00:00Z");});
test("due scheduled jobs can enter the queue",()=>{const item=rendered();item.publish={status:"scheduled",title:"Title",platforms:["youtube"],scheduledAt:"2026-09-25T00:00:00Z"};assert.throws(()=>createPublishJobs(item,new Date("2026-09-26T00:00:00Z")),/future/i);});

test("releases blocked jobs when schedule becomes due",()=>{const item=rendered();item.publish={status:"scheduled",title:"Title",platforms:["youtube"],scheduledAt:"2026-09-27T00:00:00Z"};const jobs=createPublishJobs(item,new Date("2026-09-26T00:00:00Z"));const released=releaseDuePublishJobs(jobs,new Date("2026-09-27T00:00:00Z"));assert.equal(released[0]?.status,"queued");});
test("keeps future scheduled jobs blocked",()=>{const item=rendered();item.publish={status:"scheduled",title:"Title",platforms:["youtube"],scheduledAt:"2026-09-28T00:00:00Z"};const jobs=createPublishJobs(item,new Date("2026-09-26T00:00:00Z"));assert.equal(releaseDuePublishJobs(jobs,new Date("2026-09-27T00:00:00Z"))[0]?.status,"blocked");});

test("recovers interrupted publishing jobs as retryable failures",()=>{const now=new Date("2026-09-26T10:00:00Z");const jobs=[{id:"job-1",itemId:"item-1",platform:"youtube" as const,status:"publishing" as const,attempts:1,createdAt:now.toISOString(),updatedAt:now.toISOString()}];const recovered=recoverInterruptedPublishJobs(jobs,new Date("2026-09-26T10:05:00Z"));assert.equal(recovered[0]?.status,"failed");assert.match(recovered[0]?.error ?? "",/interrupted/i);});


test("recovers TikTok publishing session as processing instead of re-uploading",()=>{
  const now=new Date("2026-09-26T10:00:00Z");
  const jobs=[{id:"tt-1",itemId:"item-1",platform:"tiktok" as const,status:"publishing" as const,attempts:1,externalPublishId:"v_pub_existing",createdAt:now.toISOString(),updatedAt:now.toISOString()}];
  const recovered=recoverInterruptedPublishJobs(jobs,new Date("2026-09-26T10:05:00Z"));
  assert.equal(recovered[0]?.status,"processing");
  assert.equal(recovered[0]?.externalPublishId,"v_pub_existing");
  assert.match(recovered[0]?.error ?? "",/check its status/i);
});


test("does not misclassify interrupted Facebook sessions as TikTok processing",()=>{const now=new Date("2026-09-27T00:00:00.000Z");const [job]=recoverInterruptedPublishJobs([{id:"fb",itemId:"item",platform:"facebook",status:"publishing",attempts:1,externalPublishId:"video-existing",createdAt:now.toISOString(),updatedAt:now.toISOString()}],now);assert.equal(job.status,"failed");assert.match(job.error??"",/facebook publishing was interrupted/i);assert.equal(job.externalPublishId,"video-existing");});
