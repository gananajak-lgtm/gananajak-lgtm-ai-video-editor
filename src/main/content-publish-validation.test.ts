import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { ContentBatchItem } from "../shared/content-factory";
import { validatePublishItem } from "./content-publish-validation";

function item(overrides: Partial<ContentBatchItem> = {}): ContentBatchItem {
  const dir=mkdtempSync(join(tmpdir(),"publish-validation-")); const outputPath=join(dir,"video.mp4"); writeFileSync(outputPath,"test");
  return { id:"item-1", status:"rendered", outputPath, brief:{topic:"test",format:"short",language:"en",targetDurationSeconds:30}, publish:{status:"ready",title:"Test",platforms:["youtube"]}, ...overrides };
}

test("accepts a rendered ready item for a supported connector",()=>{ assert.equal(validatePublishItem(item()).valid,true); });
test("requires a selected platform",()=>{ const result=validatePublishItem(item({publish:{status:"ready",title:"Test",platforms:[]}})); assert.equal(result.valid,false); assert.ok(result.issues.some(x=>x.field==="platforms")); });
test("blocks connectors that are not ready",()=>{ const result=validatePublishItem(item({publish:{status:"ready",title:"Test",platforms:["instagram"]}})); assert.ok(result.issues.some(x=>x.platform==="instagram")); });
test("rejects a schedule in the past",()=>{ const result=validatePublishItem(item({publish:{status:"scheduled",title:"Test",platforms:["youtube"],scheduledAt:"2026-01-01T00:00:00.000Z"}}),new Date("2026-09-26T00:00:00.000Z")); assert.ok(result.issues.some(x=>x.field==="scheduledAt")); });
