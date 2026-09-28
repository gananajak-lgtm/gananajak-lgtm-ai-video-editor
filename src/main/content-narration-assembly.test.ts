import assert from "node:assert/strict";
import test from "node:test";
import { buildNarrationAssemblyPlan, buildFfmpegConcatManifest } from "./content-narration-assembly";
import { buildContentProject } from "./content-scene-planner";

test("narration assembly keeps scene order and total duration", () => {
  const project = buildContentProject("demo","Mystery",{topic:"mystery",format:"short",language:"en",targetDurationSeconds:30},"One. Two.");
  const segments = [
    {sceneId:project.scenes[1].id,filePath:"/tmp/two.mp3",start:4,duration:3,text:"Two."},
    {sceneId:project.scenes[0].id,filePath:"/tmp/one.mp3",start:0,duration:4,text:"One."}
  ];
  const plan=buildNarrationAssemblyPlan(project,segments,"/tmp/narration.m4a");
  assert.deepEqual(plan.segments.map(s=>s.filePath),["/tmp/one.mp3","/tmp/two.mp3"]);
  assert.equal(plan.duration,7);
  assert.match(buildFfmpegConcatManifest(plan),/one\.mp3/);
});
