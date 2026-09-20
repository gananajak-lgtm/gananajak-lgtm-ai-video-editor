import assert from "node:assert/strict";
import test from "node:test";
import { bridgeGeneratedAssets } from "./content-timeline-bridge";
import { buildContentProject } from "./content-scene-planner";
import { buildAssetPlan } from "./content-asset-planner";

test("bridge maps generated scene assets into the existing visual plan", () => {
  const base = buildContentProject(
    "demo",
    "Island of the Dolls",
    { topic: "Island of the Dolls", format: "short", language: "en", targetDurationSeconds: 30 },
    "The canal is quiet. Dolls hang from the trees."
  );
  const plan = buildAssetPlan(base);
  const project = {
    ...base,
    assetPlan: {
      ...plan,
      assets: base.scenes.flatMap((scene, index) => [
        { id: `img-${index}`, projectId: base.id, sceneId: scene.id, kind: "image" as const, filePath: `/tmp/${index}.png` },
        { id: `voice-${index}`, projectId: base.id, sceneId: scene.id, kind: "voice" as const, filePath: `/tmp/${index}.mp3`, duration: scene.estimatedDuration }
      ])
    }
  };
  const result = bridgeGeneratedAssets(project);
  assert.equal(result.visualPlan.shots.length, base.scenes.length);
  assert.equal(result.voicePaths.length, base.scenes.length);
  assert.equal(result.missingSceneIds.length, 0);
  assert.equal(result.readyForNarrationAssembly, true);
  assert.equal(result.visualPlan.shots[1].start, base.scenes[0].estimatedDuration);
});
