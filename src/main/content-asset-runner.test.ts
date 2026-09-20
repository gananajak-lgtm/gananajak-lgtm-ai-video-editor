import assert from "node:assert/strict";
import test from "node:test";
import type { AssetProvider } from "./content-asset-provider";
import { AssetProviderRegistry } from "./content-asset-provider";
import { runAssetPlan } from "./content-asset-runner";

test("asset runner routes queued jobs through providers", async () => {
  const provider: AssetProvider = {
    id: "fake",
    supports: () => true,
    async generate(job) {
      return { id:`asset-${job.id}`, projectId:job.projectId, sceneId:job.sceneId, kind:job.kind, filePath:`/tmp/${job.id}` };
    }
  };
  const now=new Date().toISOString();
  const plan={projectId:"p",assets:[],jobs:[{id:"j",projectId:"p",sceneId:"s",kind:"image" as const,prompt:"x",status:"queued" as const,attempts:0,createdAt:now,updatedAt:now}]};
  const result=await runAssetPlan(plan,new AssetProviderRegistry([provider]),"/tmp");
  assert.equal(result.jobs[0].status,"succeeded");
  assert.equal(result.assets.length,1);
});
