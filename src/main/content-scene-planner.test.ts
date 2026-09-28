import assert from "node:assert/strict";
import test from "node:test";
import { buildContentProject } from "./content-scene-planner";

test("scene planner creates ordered scenes with prompts", () => {
  const project = buildContentProject(
    "demo",
    "Island of the Dolls",
    { topic: "Island of the Dolls", format: "short", language: "en", targetDurationSeconds: 45 },
    "A strange island hides in the canals. Dolls hang from trees. Visitors still arrive today."
  );
  assert.equal(project.scenes.length, 3);
  assert.deepEqual(project.scenes.map((scene) => scene.order), [1, 2, 3]);
  assert.ok(project.scenes.every((scene) => scene.imagePrompt.length > 0));
  assert.ok(project.scenes.every((scene) => scene.estimatedDuration >= 2.5));
});
