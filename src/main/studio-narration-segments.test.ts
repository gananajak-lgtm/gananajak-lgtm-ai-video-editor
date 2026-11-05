import test from "node:test";
import assert from "node:assert/strict";
import { planNarrationSegments } from "./studio-narration-segments";

test("600 lines become short groups with no missing or reordered lines", () => {
  const lines = Array.from({length:600},(_,i)=>({lineId:"line-"+i,audio:"/audio/"+i+".mp3",duration:2}));
  const plan = planNarrationSegments(lines);
  assert.ok(plan.segments.length < 20);
  assert.ok(plan.segments.every(s=>s.duration <= 179 && s.sources.length <= 80));
  assert.deepEqual(plan.segments.flatMap(s=>s.sources.map(x=>x.lineId)),lines.map(x=>x.lineId));
  assert.ok(Math.abs(plan.duration-(600*2+599*0.8))<0.001);
  assert.ok(Math.abs(plan.lineStarts[1]-2.8)<0.001);
});
test("gap at segment boundary is retained at start of next segment",()=>{
  const lines = [{lineId:"a",audio:"a.mp3",duration:100},{lineId:"b",audio:"b.mp3",duration:100}];
  const plan=planNarrationSegments(lines);
  assert.equal(plan.segments.length,2);
  assert.equal(plan.segments[1].leadingPause,0.8);
  assert.ok(Math.abs(plan.segments[1].start-100)<0.001);
  assert.ok(Math.abs(plan.lineStarts[1]-100.8)<0.001);
});
test("reject long voice without silently truncating it",()=>{
  assert.throws(()=>planNarrationSegments([{lineId:"a",audio:"a.mp3",duration:180}]),/too long/);
});
test("empty and duplicate inputs are guarded",()=>{
  assert.deepEqual(planNarrationSegments([]).segments,[]);
  assert.throws(()=>planNarrationSegments([{lineId:"a",audio:"a",duration:1},{lineId:"a",audio:"a",duration:2}]),/Invalid/);
});
