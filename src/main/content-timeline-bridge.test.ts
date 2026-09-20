import assert from "node:assert/strict";
import test from "node:test";
import { bridgeGeneratedAssets, buildGeneratedTimeline } from "./content-timeline-bridge";
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
  assert.equal(result.narrationSegments.length, base.scenes.length);
  assert.equal(result.missingSceneIds.length, 0);
  assert.equal(result.readyForNarrationAssembly, true);
  if (base.scenes.length > 1) {
    assert.equal(result.visualPlan.shots[1].start, base.scenes[0].estimatedDuration);
  } else {
    assert.equal(result.visualPlan.shots[0].start, 0);
  }
});


test("generated timeline prefers imported Meta video and keeps image fallback", () => {
  const base = buildContentProject(
    "hybrid",
    "Mysterious canal",
    { topic: "Mysterious canal", format: "short", language: "en", targetDurationSeconds: 15 },
    "A quiet canal disappears into the mist."
  );
  const scene = base.scenes[0];
  const project = {
    ...base,
    assetPlan: {
      projectId: base.id,
      jobs: [],
      assets: [
        { id:"img", projectId:base.id, sceneId:scene.id, kind:"image" as const, filePath:"/tmp/fallback.png" },
        { id:"video", projectId:base.id, sceneId:scene.id, kind:"video" as const, filePath:"/tmp/meta.mp4", provider:"meta-ai-manual", source:"meta-manual" as const },
        { id:"voice", projectId:base.id, sceneId:scene.id, kind:"voice" as const, filePath:"/tmp/voice.mp3", duration:7.5 }
      ]
    }
  };
  const timeline = buildGeneratedTimeline(project, "/tmp/narration.m4a");
  assert.equal(timeline.clips[0].videoPath, "/tmp/meta.mp4");
  assert.equal(timeline.clips[0].imagePath, "/tmp/fallback.png");
  assert.equal(timeline.clips[0].duration, 7.5);
  assert.equal(timeline.duration, 7.5);
});
