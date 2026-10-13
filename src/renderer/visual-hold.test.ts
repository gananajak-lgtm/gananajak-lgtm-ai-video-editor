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
