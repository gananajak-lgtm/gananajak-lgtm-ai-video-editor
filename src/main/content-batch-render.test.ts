import assert from "node:assert/strict";
import test from "node:test";
import type { ContentBatch } from "../shared/content-factory";
import { createContentBatch } from "./content-batch";

test("batch render state supports ready assets and output paths",()=>{
  const batch:ContentBatch=createContentBatch([{topic:"one",format:"short",language:"th",targetDurationSeconds:30}]);
  batch.items[0].status="assets-ready";
  assert.equal(batch.items[0].status,"assets-ready");
  batch.items[0].status="rendered";
  batch.items[0].outputPath="/tmp/one.mp4";
  assert.equal(batch.items[0].outputPath,"/tmp/one.mp4");
});
