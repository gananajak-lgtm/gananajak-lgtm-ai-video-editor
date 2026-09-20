import assert from "node:assert/strict";
import test from "node:test";
import type { AssetProvider } from "./content-asset-provider";
import { AssetProviderRegistry } from "./content-asset-provider";
import { runAssetPlan } from "./content-asset-runner";
import { buildAssetPlan } from "./content-asset-planner";
import { buildContentProject } from "./content-scene-planner";
import { buildGeneratedTimeline } from "./content-timeline-bridge";

test("content factory flows from topic project through generated assets into a renderable hybrid timeline", async () => {
  const project = buildContentProject(
    "e2e",
    "Fog Forest",
    { topic:"Fog Forest", format:"short", language:"en", targetDurationSeconds:20 },
    "The trail disappears into fog. A lantern glows between the trees."
  );
  const planned = buildAssetPlan(project);
  const provider: AssetProvider = {
    id:"fake-required",
    supports:(kind) => kind === "image" || kind === "voice",
    async generate(job) {
      return {
        id:`asset-${job.id}`,
        projectId:job.projectId,
        sceneId:job.sceneId,
        kind:job.kind,
        filePath:`/tmp/${job.id}.${job.kind === "voice" ? "mp3" : "png"}`,
        duration:job.kind === "voice" ? 6 : undefined
      };
    }
  };
  const generated = await runAssetPlan(planned,new AssetProviderRegistry([provider]),"/tmp");
  const firstScene = project.scenes[0];
  const videoJob = generated.jobs.find((job) => job.sceneId === firstScene.id && job.kind === "video");
  assert.ok(videoJob);
  const metaAsset = {
    id:`asset-${videoJob.id}-meta`,
    projectId:project.id,
    sceneId:firstScene.id,
    kind:"video" as const,
    filePath:"/tmp/meta.mp4",
    duration:4,
    provider:"meta-ai-manual",
    source:"meta-manual" as const
  };
  const hydrated = { ...project, assetPlan:{ ...generated, assets:[...generated.assets,metaAsset] } };
  const timeline = buildGeneratedTimeline(hydrated,"/tmp/narration.m4a");
  assert.equal(timeline.clips.length,project.scenes.length);
  assert.equal(timeline.clips[0].videoPath,"/tmp/meta.mp4");
  assert.ok(timeline.clips[0].imagePath.endsWith(".png"));
  assert.equal(timeline.clips[0].videoDuration,4);
  assert.ok(timeline.clips.slice(1).every((clip) => !clip.videoPath && clip.imagePath.endsWith(".png")));
  assert.equal(timeline.subtitles?.length,project.scenes.length);
  assert.equal(timeline.width,1080);
  assert.equal(timeline.height,1920);
});
