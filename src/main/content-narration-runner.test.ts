import assert from "node:assert/strict";
import test from "node:test";
import { buildNarrationConcatArgs } from "./content-narration-assembly";

test("narration concat uses ffmpeg concat demuxer and AAC output", () => {
  const args=buildNarrationConcatArgs("/tmp/list.txt","/tmp/out.m4a");
  assert.ok(args.includes("concat"));
  assert.ok(args.includes("aac"));
  assert.equal(args.at(-1),"/tmp/out.m4a");
});
