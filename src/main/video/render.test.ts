import assert from "node:assert/strict";
import test from "node:test";
import type { TimelinePlan } from "../../shared/types";
import { createVideoFilter } from "./render";

function plan(overrides: Partial<TimelinePlan> = {}): TimelinePlan {
  return {
    duration: 7.5,
    narration: "/tmp/narration.m4a",
    width: 1080,
    height: 1920,
    fps: 30,
    clips: [{
      id:"scene-1",
      imagePath:"/tmp/fallback.png",
      videoPath:"/tmp/meta.mp4",
      videoDuration:5,
      start:0,
      duration:7.5,
      motion:"slow-zoom-in"
    }],
    audioLayers:[],
    subtitles:[],
    transitionDuration:0.25,
    quality:"high",
    ...overrides
  };
}

test("short Meta video is concatenated with image fallback", () => {
  const filter = createVideoFilter(plan(),null).filters.join(";");
  assert.match(filter,/trim=duration=5\.000/);
  assert.match(filter,/trim=duration=2\.500/);
  assert.match(filter,/concat=n=2:v=1:a=0\[v0\]/);
});

test("Meta video covering the scene does not append image fallback", () => {
  const value=plan();
  value.clips[0].videoDuration=10;
  const filter=createVideoFilter(value,null).filters.join(";");
  assert.doesNotMatch(filter,/vfallback0/);
  assert.match(filter,/trim=duration=7\.500/);
});

test("image-only scene keeps image motion rendering", () => {
  const value=plan();
  value.clips[0].videoPath=undefined;
  value.clips[0].videoDuration=undefined;
  const filter=createVideoFilter(value,null).filters.join(";");
  assert.doesNotMatch(filter,/vfallback0/);
  assert.match(filter,/zoompan=/);
});


test("video filter supports compact visual input bindings without dummy inputs", () => {
  const value = plan();
  value.clips[0] = { id:"short-meta", imagePath:"/tmp/fallback.png", videoPath:"/tmp/meta.mp4", videoDuration:5, start:0, duration:7.5, motion:"hold" };
  const result = createVideoFilter(value,null,[{primary:0,fallback:1}]);
  assert.match(result.filters[0],/^\[0:v\]/);
  assert.match(result.filters[0],/\[1:v\]/);
  assert.doesNotMatch(result.filters[0],/\[2:v\]/);
});
