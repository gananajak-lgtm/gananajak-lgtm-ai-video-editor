import test from "node:test";
import assert from "node:assert/strict";
import { computeMyCutImageCuts, parseMyCutStoryboardLineCue } from "./mycut-image-cuts";

test("V1 covers the 0.3-second voice pause with no gaps", () => {
  const cuts=computeMyCutImageCuts([0,4.3,7.3],11,3,[null,null,null]);
  assert.deepEqual(cuts,[0,4.3,7.3,11]);
  assert.equal(cuts.slice(1).reduce((sum,v,i)=>sum+v-cuts[i],0),11);
});
test("explicit storyboard line 3 sets second image at voice line 3",()=>{
  assert.deepEqual(computeMyCutImageCuts([0,4.3,7.3],11,2,[null,2]),[0,7.3,11]);
});
test("invalid overlapping cue is rejected before project file is written",()=>{
  assert.throws(()=>computeMyCutImageCuts([0,4.3,7.3],11,3,[null,2,1]),/Conflicting/);
});
test("more images than lines are subdivided without zero duration",()=>{
  const cuts=computeMyCutImageCuts([0,4.3],8,5,[null,null,null,null,null]);
  assert.equal(cuts[0],0);assert.equal(cuts.at(-1),8);
  assert.ok(cuts.every((n,i)=>i===0||n>cuts[i-1]));
});

test("conflicting consecutive image cues reject duplicate line starts",()=>{
  assert.throws(()=>computeMyCutImageCuts([0,4.3,7.3],11,3,[null,1,1]),/Conflicting/);
});
test("out of range image cue is rejected",()=>{
  assert.throws(()=>computeMyCutImageCuts([0,4.3],8,2,[null,3]),/Conflicting/);
});
test("single visual covers the entire narration",()=>{
  assert.deepEqual(computeMyCutImageCuts([0,4.3,7.3],11,1,[null]),[0,11]);
});

test("first image cannot be pinned to a later voice line",()=>{
  assert.throws(()=>computeMyCutImageCuts([0,4.3,7.3],11,2,[1,null]),/Conflicting storyboard line cue at image 1/);
});
test("first image may explicitly reference line one at zero",()=>{
  assert.deepEqual(computeMyCutImageCuts([0,4.3],8,2,[0,null]),[0,4.3,8]);
});
test("invalid first image cue rejects even a single full-length image",()=>{
  assert.throws(()=>computeMyCutImageCuts([0,4.3],8,1,[2]),/Conflicting storyboard line cue at image 1/);
});

test("sidecar line cues recognize English and Thai locations",()=>{
  assert.equal(parseMyCutStoryboardLineCue("line: 2\nwalking",3),1);
  assert.equal(parseMyCutStoryboardLineCue("บรรทัด: 3\nฉากป่า",3),2);
  assert.equal(parseMyCutStoryboardLineCue("plain caption",3),null);
});
test("invalid sidecar cues are rejected rather than silently ignored",()=>{
  for (const cue of ["line: 0","line: 999","line: abc","บรรทัด: -1","line: 1.5"]) {
    assert.throws(()=>parseMyCutStoryboardLineCue(cue,3),/storyboard line cue/i);
  }
});
