import assert from "node:assert/strict";
import test from "node:test";
import { scheduleDialogueClips } from "./dialogue-timeline";

test("places clips sequentially without overlap", () => {
  assert.deepEqual(
    scheduleDialogueClips([{ lineId: "1", filePath: "a.mp3", duration: 2.5 }, { lineId: "2", filePath: "b.mp3", duration: 3 }], 0.25),
    [{ lineId: "1", filePath: "a.mp3", duration: 2.5, start: 0, end: 2.5 }, { lineId: "2", filePath: "b.mp3", duration: 3, start: 2.75, end: 5.75 }]
  );
});

test("rejects corrupt durations and duplicate lines", () => {
  assert.throws(() => scheduleDialogueClips([{ lineId: "1", filePath: "a", duration: NaN }]));
  assert.throws(() => scheduleDialogueClips([{ lineId: "1", filePath: "a", duration: 1 }, { lineId: "1", filePath: "b", duration: 2 }]));
});
