import assert from "node:assert/strict";
import test from "node:test";
import { buildContentProject } from "./content-scene-planner";
import { buildAssetPlan } from "./content-asset-planner";
import { AssetJobQueue } from "./content-asset-queue";

test("asset planner creates image and voice jobs for every scene", () => {
  const project = buildContentProject(
    "demo",
    "Island of the Dolls",
    { topic: "Island of the Dolls", format: "short", language: "en", targetDurationSeconds: 45 },
    "A strange island hides in the canals. Dolls hang from trees."
  );
  const plan = buildAssetPlan(project);
  assert.equal(plan.jobs.filter((job) => job.kind === "image").length, project.scenes.length);
  assert.equal(plan.jobs.filter((job) => job.kind === "voice").length, project.scenes.length);
});

test("asset queue tracks running, failure, retry and completion", () => {
  const project = buildContentProject(
    "demo",
    "Island of the Dolls",
    { topic: "Island of the Dolls", format: "short", language: "en", targetDurationSeconds: 45 },
    "Dolls hang from trees."
  );
  const plan = buildAssetPlan(project, { includeVoice: false });
  const queue = new AssetJobQueue(plan.jobs);
  const job = queue.next();
  assert.ok(job);
  queue.markRunning(job.id);
  assert.equal(queue.snapshot()[0].attempts, 1);
  queue.fail(job.id, "provider timeout");
  queue.retry(job.id);
  queue.markRunning(job.id);
  queue.complete(job.id, {
    id: "asset-1",
    projectId: project.id,
    sceneId: project.scenes[0].id,
    kind: "image",
    filePath: "/tmp/asset.png"
  });
  assert.equal(queue.snapshot()[0].status, "succeeded");
  assert.equal(queue.snapshot()[0].attempts, 2);
});
