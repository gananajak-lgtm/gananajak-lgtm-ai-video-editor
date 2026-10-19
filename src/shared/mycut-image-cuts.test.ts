import test from "node:test";
import assert from "node:assert/strict";
import { computeMyCutImageCuts } from "./mycut-image-cuts";

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
