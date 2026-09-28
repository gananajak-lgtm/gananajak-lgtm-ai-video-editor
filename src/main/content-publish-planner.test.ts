import assert from "node:assert/strict";
import test from "node:test";
import { buildPublishPlan } from "./content-publish-planner";
import type { ContentBatchItem } from "../shared/content-factory";

test("publish planner marks rendered output ready and creates metadata", () => {
  const item: ContentBatchItem = { id:"item-1", brief:{ topic:"Island of the Dolls", format:"short", language:"en", targetDurationSeconds:60 }, status:"rendered", outputPath:"C:/videos/island.mp4" };
  const plan = buildPublishPlan(item);
  assert.equal(plan.status, "ready");
  assert.equal(plan.title, "Island of the Dolls");
  assert.ok(plan.description?.includes("Island of the Dolls"));
  assert.ok(plan.hashtags?.includes("Shorts"));
});

test("publish planner keeps unrendered item as draft", () => {
  const item: ContentBatchItem = { id:"item-2", brief:{ topic:"ป่าลึกลับ", format:"episode", language:"th", targetDurationSeconds:180 }, status:"ready" };
  assert.equal(buildPublishPlan(item).status, "draft");
});
