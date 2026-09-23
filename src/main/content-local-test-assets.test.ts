import assert from "node:assert/strict";
import test from "node:test";
import { access, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildLocalTestProject } from "./content-scene-planner";
import { generateLocalTestAssets } from "./content-local-test-assets";

test("local test assets create real placeholder image and silent narration for every scene", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "gananajak-local-assets-"));
  try {
    const project = buildLocalTestProject({ topic:"Pipeline smoke test", format:"short", language:"en", targetDurationSeconds:30 });
    const prepared = await generateLocalTestAssets(project, root);
    assert.ok(prepared.assetPlan);
    assert.equal(prepared.assetPlan.assets.length, project.scenes.length * 2);
    assert.equal(prepared.assetPlan.jobs.length, prepared.assetPlan.assets.length);
    assert.ok(prepared.assetPlan.jobs.every((job) => job.status === "succeeded"));
    for (const scene of project.scenes) {
      const image = prepared.assetPlan.assets.find((asset) => asset.sceneId === scene.id && asset.kind === "image");
      const voice = prepared.assetPlan.assets.find((asset) => asset.sceneId === scene.id && asset.kind === "voice");
      assert.ok(image);
      assert.ok(voice);
      assert.ok((voice.duration ?? 0) >= 2.5);
      await access(image.filePath);
      await access(voice.filePath);
    }
  } finally {
    await rm(root, { recursive:true, force:true });
  }
});
