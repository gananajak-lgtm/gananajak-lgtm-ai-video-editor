import assert from "node:assert/strict";
import test from "node:test";
import type { ContentBrief, ContentProject } from "../shared/content-factory";
import { createContentBatch, prepareContentBatch } from "./content-batch";

const brief = (topic: string): ContentBrief => ({
  topic, format:"short", language:"th", targetDurationSeconds:30
});

const project = (b: ContentBrief): ContentProject => ({
  schemaVersion:1, id:`project-${b.topic}`, title:b.topic, brief:b, script:b.topic,
  scenes:[], createdAt:new Date(0).toISOString(), updatedAt:new Date(0).toISOString()
});

test("prepares multiple topics independently and keeps failures resumable", async () => {
  const batch=createContentBatch([brief("one"),brief("two"),brief("three")]);
  const first=await prepareContentBatch(batch,async (b)=>{
    if(b.topic==="two") throw new Error("temporary failure");
    return project(b);
  });
  assert.deepEqual(first.items.map(i=>i.status),["ready","failed","ready"]);
  assert.equal(first.items[1].error,"temporary failure");

  let calls=0;
  const resumed=await prepareContentBatch(first,async (b)=>{calls+=1;return project(b);});
  assert.equal(calls,1);
  assert.deepEqual(resumed.items.map(i=>i.status),["ready","ready","ready"]);
});
