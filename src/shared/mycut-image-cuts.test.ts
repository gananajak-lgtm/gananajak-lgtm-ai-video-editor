import test from "node:test";
import assert from "node:assert/strict";
import { assertMyCutContinuousVisualCuts, assertMyCutVoiceTimeline, buildMyCutShotReview, computeMyCutImageCuts, parseMyCutStoryboardLineCue } from "./mycut-image-cuts";

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


test("CRLF sidecar line cues are parsed without swallowing following text",()=>{
  assert.equal(parseMyCutStoryboardLineCue("บรรทัด: 2\r\nรายละเอียดภาพ",3),1);
  assert.equal(parseMyCutStoryboardLineCue("line: 1\r\nportrait",3),0);
});
test("duplicate explicit storyboard line cues are rejected",()=>{
  assert.throws(()=>parseMyCutStoryboardLineCue("line: 1\nบรรทัด: 2",3),/Duplicate storyboard line cues/);
  assert.throws(()=>parseMyCutStoryboardLineCue("line: 1\r\nline: 1",3),/Duplicate storyboard line cues/);
});

test("V1 continuity validator accepts computed cuts covering narration pauses",()=>{
  const cuts = computeMyCutImageCuts([0,4.3,7.3],11,3,[null,null,null]);
  assert.doesNotThrow(()=>assertMyCutContinuousVisualCuts(cuts,11));
});
test("V1 continuity validator rejects zero-length, missing boundaries and bad times",()=>{
  for (const cuts of [[0,0,11],[0,4,4,11],[0,8,7,11],[1,5,11],[0,5,10],[0,NaN,11],[0,Infinity,11]]) {
    assert.throws(()=>assertMyCutContinuousVisualCuts(cuts,11),/V1 continuity/);
  }
});

test("A1 keeps 0.3 seconds between voice lines, without trailing silence",()=>{
  assert.doesNotThrow(()=>assertMyCutVoiceTimeline([0,4.3,7.3],[4,2.7,3.7],11));
  assert.doesNotThrow(()=>assertMyCutVoiceTimeline([0],[4],4));
});
test("A1 rejects overlapping, missing gap, invalid or trailing audio timing",()=>{
  for(const [starts,durations,end] of [
    [[0,3.9],[4,2],5.9], [[0,4.5],[4,2],6.5],
    [[0,4.3],[4,2],6.4], [[0,4.3],[4,0],4.3],
    [[0,4.3],[4,2],NaN], [[0,4.3],[4,2],6.5]
  ] as Array<[number[],number[],number]>) {
    assert.throws(()=>assertMyCutVoiceTimeline(starts,durations,end),/MyCut A1/);
  }
});

test("read-only shot review shows consecutive image positions and precise durations",()=>{
  assert.deepEqual(buildMyCutShotReview(["a.png","b.png","c.png"],[0,4.3,7.3,11],11),[
    {image:"a.png",position:1,start:0,end:4.3,duration:4.3},
    {image:"b.png",position:2,start:4.3,end:7.3,duration:3},
    {image:"c.png",position:3,start:7.3,end:11,duration:3.7}
  ]);
});
test("shot review rejects mismatched image counts, empty names and invalid cuts",()=>{
  assert.throws(()=>buildMyCutShotReview(["a.png"],[0,5,11],11),/shot review/);
  assert.throws(()=>buildMyCutShotReview([""],[0,11],11),/shot review/);
  assert.throws(()=>buildMyCutShotReview(["a.png","b.png"],[0,6,6],11),/shot review|continuity/);
});
