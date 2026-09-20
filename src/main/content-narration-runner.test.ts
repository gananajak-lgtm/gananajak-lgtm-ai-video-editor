import assert from "node:assert/strict";
import test from "node:test";
import { buildNarrationAssemblyPlan, buildNarrationConcatArgs } from "./content-narration-assembly";
import { buildContentProject } from "./content-scene-planner";

test("narration concat uses ffmpeg concat demuxer and AAC output", () => {
  const args=buildNarrationConcatArgs("/tmp/list.txt","/tmp/out.m4a");
  assert.ok(args.includes("concat"));
  assert.ok(args.includes("aac"));
  assert.equal(args.at(-1),"/tmp/out.m4a");
});


test("narration assembly rejects duplicate or mismatched scene segments", () => {
  const project = buildContentProject(
    "narration-guard",
    "Two scenes",
    { topic:"Two scenes", format:"short", language:"en", targetDurationSeconds:20 },
    "First sentence. Second sentence."
  );
  assert.ok(project.scenes.length >= 1);
  const first = project.scenes[0];
  const duplicate = project.scenes.map((scene, index) => ({
    sceneId:index === project.scenes.length - 1 ? first.id : scene.id,
    filePath:`/tmp/${index}.mp3`,
    start:index * 5,
    duration:5,
    text:scene.narration
  }));
  assert.throws(
    () => buildNarrationAssemblyPlan(project,duplicate,"/tmp/out.m4a"),
    /exactly one matching voice asset per scene/
  );
});
