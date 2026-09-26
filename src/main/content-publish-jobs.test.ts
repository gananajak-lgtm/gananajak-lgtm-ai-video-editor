import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { ContentBatchItem } from "../shared/content-factory";
import { createPublishJobs } from "./content-publish-jobs";

function rendered():ContentBatchItem { const dir=mkdtempSync(join(tmpdir(),"publish-job-")); const outputPath=join(dir,"video.mp4"); writeFileSync(outputPath,"x"); return {id:"item",status:"rendered",outputPath,brief:{topic:"Topic",format:"short",language:"en",targetDurationSeconds:30},publish:{status:"ready",title:"Title",platforms:["youtube","tiktok"]}}; }
test("creates one queued job per supported platform",()=>{const jobs=createPublishJobs(rendered(),new Date("2026-09-26T00:00:00Z"));assert.equal(jobs.length,2);assert.deepEqual(jobs.map(x=>x.platform),["youtube","tiktok"]);assert.ok(jobs.every(x=>x.status==="queued"&&x.attempts===0));});
test("blocks invalid publish items",()=>{const item=rendered();item.publish={status:"ready",title:"Title",platforms:["instagram"]};assert.throws(()=>createPublishJobs(item),/not ready/i);});

test("future scheduled jobs stay blocked until due",()=>{const item=rendered();item.publish={status:"scheduled",title:"Title",platforms:["youtube"],scheduledAt:"2026-09-27T00:00:00Z"};const jobs=createPublishJobs(item,new Date("2026-09-26T00:00:00Z"));assert.equal(jobs[0]?.status,"blocked");assert.equal(jobs[0]?.scheduledAt,"2026-09-27T00:00:00Z");});
test("due scheduled jobs can enter the queue",()=>{const item=rendered();item.publish={status:"scheduled",title:"Title",platforms:["youtube"],scheduledAt:"2026-09-25T00:00:00Z"};assert.throws(()=>createPublishJobs(item,new Date("2026-09-26T00:00:00Z")),/future/i);});
