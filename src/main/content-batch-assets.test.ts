import assert from "node:assert/strict";
import test from "node:test";
import type { AssetJob, ContentBrief, ContentProject, GeneratedAsset } from "../shared/content-factory";
import { AssetProviderRegistry } from "./content-asset-provider";
import { createContentBatch } from "./content-batch";
import { generateBatchAssets } from "./content-batch-assets";

const brief:ContentBrief={topic:"factory",format:"short",language:"th",targetDurationSeconds:30};
const now=new Date(0).toISOString();
const project:ContentProject={schemaVersion:1,id:"p1",title:"factory",brief,script:"x",createdAt:now,updatedAt:now,scenes:[{id:"s1",order:1,narration:"hello",visualIntent:"forest",imagePrompt:"forest",videoPrompt:"move",sfxHints:[],estimatedDuration:5}]};

class FakeProvider {
  readonly id:string;
  constructor(private kind:"image"|"voice"){this.id=`fake-${kind}`;}
  supports(kind:AssetJob["kind"]){return kind===this.kind;}
  async generate(job:AssetJob):Promise<GeneratedAsset>{
    return {id:`asset-${job.id}`,projectId:job.projectId,sceneId:job.sceneId,kind:this.kind,filePath:`/tmp/${job.id}`,source:"generated"};
  }
}

test("generates required image and voice assets without blocking on manual video",async()=>{
  const registry=new AssetProviderRegistry([new FakeProvider("image"),new FakeProvider("voice")]);
  const batch=createContentBatch([brief]);
  batch.items[0].project=project; batch.items[0].status="ready";
  const result=await generateBatchAssets(batch,registry,"/tmp/factory");
  assert.equal(result.items[0].status,"assets-ready");
  const jobs=result.items[0].project!.assetPlan!.jobs;
  assert.equal(jobs.find(j=>j.kind==="image")?.status,"succeeded");
  assert.equal(jobs.find(j=>j.kind==="voice")?.status,"succeeded");
  assert.equal(jobs.find(j=>j.kind==="video")?.status,"queued");
});
