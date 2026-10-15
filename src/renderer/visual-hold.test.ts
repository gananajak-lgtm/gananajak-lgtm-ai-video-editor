import assert from "node:assert/strict";
import test from "node:test";
import { holdFramesThroughDialogue, restoreFrameAnchors } from "./visual-hold";

const lines = [
  { lineId: "a", start: 0, end: 3 },
  { lineId: "b", start: 3.6, end: 8 },
  { lineId: "c", start: 8.3, end: 12 },
  { lineId: "d", start: 13, end: 18 }
];

test("holds a still across subsequent voice lines and their pauses", () => {
  assert.deepEqual(holdFramesThroughDialogue(lines, [
    { imageId: "forest.png", lineId: "a" },
    { imageId: "river.png", lineId: "c" }
  ]), [
    { imageId: "forest.png", anchorLineId: "a", start: 0, end: 8.3 },
    { imageId: "river.png", anchorLineId: "c", start: 8.3, end: 18 }
  ]);
});

test("rejects unknown, duplicate and out-of-order scene anchors", () => {
  assert.throws(() => holdFramesThroughDialogue(lines, [{ imageId: "x", lineId: "missing" }]));
  assert.throws(() => holdFramesThroughDialogue(lines, [{ imageId: "x", lineId: "a" }, { imageId: "y", lineId: "a" }]));
  assert.throws(() => holdFramesThroughDialogue(lines, [{ imageId: "x", lineId: "a" }, { imageId: "x", lineId: "c" }]));
  assert.throws(() => holdFramesThroughDialogue(lines, [{ imageId: "x", lineId: "c" }]));
  assert.throws(() => holdFramesThroughDialogue(lines, [{ imageId: "x", lineId: "a" }, { imageId: "y", lineId: "b" }, { imageId: "z", lineId: "a" }]));
});

test("rejects overlapping or invalid voice schedules", () => {
  assert.throws(() => holdFramesThroughDialogue([{ lineId: "a", start: 0, end: 3 }, { lineId: "b", start: 2, end: 4 }], [{ imageId: "x", lineId: "a" }]));
  assert.throws(() => holdFramesThroughDialogue([{ lineId: "a", start: 0, end: Number.NaN }], [{ imageId: "x", lineId: "a" }]));
});

test("returns no holds until a voice schedule and anchors exist", () => {
  assert.deepEqual(holdFramesThroughDialogue([], []), []);
  assert.deepEqual(holdFramesThroughDialogue(lines, []), []);
});

test("restores only anchors for current image clips from persisted JSON", () => {
  const stored = JSON.parse(JSON.stringify({ frame1: "line-1", deleted: "line-2", frame2: 123 }));
  assert.deepEqual(restoreFrameAnchors(stored, ["frame1", "frame2"]), { frame1: "line-1" });
  assert.deepEqual(restoreFrameAnchors(null, ["frame1"]), {});
  assert.deepEqual(restoreFrameAnchors(["line-1"], ["0"]), {});
});


test("drops restored anchors pointing to deleted voice lines when a voice-line catalog is available", () => {
  const stored = { frame1: "line-1", frame2: "deleted-line", frame3: "" };
  assert.deepEqual(restoreFrameAnchors(stored, ["frame1", "frame2", "frame3"], ["line-1"]), { frame1: "line-1" });
  assert.deepEqual(restoreFrameAnchors(stored, ["frame1", "frame2", "frame3"]), { frame1: "line-1", frame2: "deleted-line" });
});

test("frame holds include dialogue pauses but switch exactly at next scene anchor", () => {
  const schedule = [
    { lineId: "opening", start: 0, end: 1.2 },
    { lineId: "response", start: 1.8, end: 3 },
    { lineId: "scene-change", start: 4.5, end: 5.5 },
    { lineId: "closing", start: 6.25, end: 8.75 }
  ];
  const frames = holdFramesThroughDialogue(schedule, [
    { imageId: "master-1", lineId: "opening" },
    { imageId: "master-2", lineId: "scene-change" }
  ]);
  assert.deepEqual(frames, [
    { imageId: "master-1", anchorLineId: "opening", start: 0, end: 4.5 },
    { imageId: "master-2", anchorLineId: "scene-change", start: 4.5, end: 8.75 }
  ]);
  assert.equal(frames[0].end, frames[1].start, "no visual gap or overlap at scene change");
  assert.equal(frames[1].end, schedule.at(-1)!.end, "last image covers final voice");
});

test("frame hold planner rejects non-monotonic voice lines including reversed starts", () => {
  assert.throws(() => holdFramesThroughDialogue([
    { lineId: "first", start: 4, end: 5 },
    { lineId: "second", start: 2, end: 3 }
  ], [{ imageId: "frame", lineId: "first" }]), /Invalid or overlapping voice schedule/);
});
