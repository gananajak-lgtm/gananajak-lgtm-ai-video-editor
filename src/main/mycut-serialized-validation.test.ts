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

test("serialized MyCut validates the actual JSON round trip",()=>{
 const saved=JSON.stringify(fixture());
 assert.doesNotThrow(()=>assertSerializedMyCutTimeline(JSON.parse(saved)));
});
test("serialized MyCut rejects duplicate media ids and overlong clips",()=>{
 const duplicated=fixture();
 duplicated.media[1].id=duplicated.media[0].id;
 assert.throws(()=>assertSerializedMyCutTimeline(duplicated),/media references/);
 const overlong=fixture();
 overlong.clips[2].dur=3.31;
 assert.throws(()=>assertSerializedMyCutTimeline(overlong),/clip bounds/);
});
test("serialized MyCut rejects overlapping V1 shots and unknown tracks",()=>{
 const overlap=fixture();
 overlap.clips[2].dur=2;
 overlap.media.push({id:"mi2",path:"second.png"});
 overlap.clips.push({track:"V1",mediaId:"mi2",path:"second.png",start:1.5,dur:1.8});
 assert.throws(()=>assertSerializedMyCutTimeline(overlap),/V1 gap or overlap/);
 const wrongTrack=fixture();
 wrongTrack.clips[2].track="A2";
 assert.throws(()=>assertSerializedMyCutTimeline(wrongTrack),/track assignment/);
});

test("serialized MyCut rejects duplicate clip IDs and wrong media kinds",()=>{
 const duplicate=fixture();
 const clipsWithIds=duplicate.clips.map((clip,index)=>({...clip,id:index===0?"same":index===1?"same":"unique"}));
 assert.throws(()=>assertSerializedMyCutTimeline({...duplicate,clips:clipsWithIds}),/duplicate or missing clip IDs/);
 const wrongKind=fixture();
 const mediaWithKinds=wrongKind.media.map((media,index)=>({...media,kind:index===2?"audio":"audio"}));
 assert.throws(()=>assertSerializedMyCutTimeline({...wrongKind,media:mediaWithKinds}),/track\/media kind mismatch/);
 const valid=fixture();
 const validMedia=valid.media.map((media,index)=>({...media,kind:index===2?"image":"audio"}));
 const validClips=valid.clips.map((clip,index)=>({...clip,id:"clip-"+index,kind:clip.track==="V1"?"image":"audio"}));
 assert.doesNotThrow(()=>assertSerializedMyCutTimeline({...valid,media:validMedia,clips:validClips}));
});
