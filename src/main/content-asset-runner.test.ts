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


test("asset runner preserves optional manual jobs while completing required assets", async () => {
  const provider: AssetProvider = {
    id: "fake-required",
    supports: (kind) => kind === "image" || kind === "voice",
    async generate(job) {
      return { id:`asset-${job.id}`, projectId:job.projectId, sceneId:job.sceneId, kind:job.kind, filePath:`/tmp/${job.id}` };
    }
  };
  const now=new Date().toISOString();
  const makeJob=(id:string,kind:"image"|"voice"|"video"|"sfx") => ({id,projectId:"p",sceneId:"s",kind,prompt:"x",status:"queued" as const,attempts:0,createdAt:now,updatedAt:now});
  const plan={projectId:"p",assets:[],jobs:[makeJob("img","image"),makeJob("voice","voice"),makeJob("video","video"),makeJob("sfx","sfx")]};
  const result=await runAssetPlan(plan,new AssetProviderRegistry([provider]),"/tmp");
  assert.equal(result.jobs.find((job)=>job.id==="img")?.status,"succeeded");
  assert.equal(result.jobs.find((job)=>job.id==="voice")?.status,"succeeded");
  assert.equal(result.jobs.find((job)=>job.id==="video")?.status,"queued");
  assert.equal(result.jobs.find((job)=>job.id==="sfx")?.status,"queued");
  assert.equal(result.assets.length,2);
});


test("asset progress counts only automatically runnable jobs", async () => {
  const provider: AssetProvider = {
    id: "fake-progress",
    supports: () => true,
    async generate(job) {
      return { id:`asset-${job.id}`, projectId:job.projectId, sceneId:job.sceneId, kind:job.kind, filePath:`/tmp/${job.id}` };
    }
  };
  const now=new Date().toISOString();
  const plan={projectId:"p",assets:[{id:"asset-video",projectId:"p",sceneId:"s",kind:"video" as const,filePath:"/tmp/video.mp4"}],jobs:[
    {id:"img",projectId:"p",sceneId:"s",kind:"image" as const,prompt:"x",status:"queued" as const,attempts:0,createdAt:now,updatedAt:now},
    {id:"video",projectId:"p",sceneId:"s",kind:"video" as const,prompt:"x",status:"succeeded" as const,attempts:1,outputAssetId:"asset-video",createdAt:now,updatedAt:now}
  ]};
  const progress: Array<{completed:number;total:number}> = [];
  await runAssetPlan(plan,new AssetProviderRegistry([provider]),"/tmp",(value)=>progress.push(value));
  assert.ok(progress.every((value)=>value.completed <= value.total));
  assert.equal(progress.at(-1)?.completed,1);
  assert.equal(progress.at(-1)?.total,1);
});


test("asset runner replaces a previous job asset instead of duplicating it", async () => {
  const provider: AssetProvider = {
    id:"fake-retry",
    supports:() => true,
    async generate(job) {
      return { id:`asset-${job.id}-new`, projectId:job.projectId, sceneId:job.sceneId, kind:job.kind, filePath:"/tmp/new.png" };
    }
  };
  const now=new Date().toISOString();
  const plan={projectId:"p",assets:[{id:"asset-img-old",projectId:"p",sceneId:"s",kind:"image" as const,filePath:"/tmp/old.png"}],jobs:[
    {id:"img",projectId:"p",sceneId:"s",kind:"image" as const,prompt:"retry",status:"queued" as const,attempts:1,outputAssetId:"asset-img-old",createdAt:now,updatedAt:now}
  ]};
  const result=await runAssetPlan(plan,new AssetProviderRegistry([provider]),"/tmp");
  assert.equal(result.assets.length,1);
  assert.equal(result.assets[0].filePath,"/tmp/new.png");
  assert.equal(result.jobs[0].status,"succeeded");
  assert.equal(result.jobs[0].outputAssetId,"asset-img-new");
});
