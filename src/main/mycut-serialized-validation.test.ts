import test from "node:test";
import assert from "node:assert/strict";
import { assertSerializedMyCutTimeline } from "./mycut-serialized-validation";

const fixture=()=>({
 dur: 3.3,
 media: [{id:"ma",path:"a.mp3"},{id:"mb",path:"b.mp3"},{id:"mi",path:"still.png"}],
 clips: [
  {track:"A1",mediaId:"ma",path:"a.mp3",start:0,dur:1},
  {track:"A1",mediaId:"mb",path:"b.mp3",start:1.3,dur:2},
  {track:"V1",mediaId:"mi",path:"still.png",start:0,dur:3.3}
 ]
});
test("serialized MyCut validates contiguous stills and narration pause",()=>{
 assert.doesNotThrow(()=>assertSerializedMyCutTimeline(fixture()));
});
test("serialized MyCut rejects broken media paths and audio gaps",()=>{
 const p=fixture(); p.clips[0].path="wrong.mp3";
 assert.throws(()=>assertSerializedMyCutTimeline(p),/media references/);
 const q=fixture(); q.clips[1].start=1.4; q.dur=3.4; q.clips[2].dur=3.4;
 assert.throws(()=>assertSerializedMyCutTimeline(q),/MyCut A1/);
});
test("serialized MyCut rejects V1 gaps even if final image ends on time",()=>{
 const p=fixture();
 p.clips[2].dur=1;
 p.media.push({id:"mi2",path:"second.png"});
 p.clips.push({track:"V1",mediaId:"mi2",path:"second.png",start:1.4,dur:1.9});
 assert.throws(()=>assertSerializedMyCutTimeline(p),/V1 gap or overlap/);
});
