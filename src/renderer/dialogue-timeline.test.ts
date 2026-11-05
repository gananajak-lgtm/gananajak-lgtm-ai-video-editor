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

test("adds a natural default pause between consecutive voice clips", () => {
  const clips = scheduleDialogueClips([{lineId:"1",filePath:"a",duration:2},{lineId:"2",filePath:"b",duration:3}]);
  assert.equal(clips[1].start, 2.3);
});
test("uses speaker-change and narration pacing when metadata is provided", () => {
  const clips = scheduleDialogueClips([
    {lineId:"1",filePath:"a",duration:2,speaker:"สิงห์",kind:"dialogue"},
    {lineId:"2",filePath:"b",duration:2,speaker:"อิน",kind:"dialogue"},
    {lineId:"3",filePath:"c",duration:2,speaker:"ผู้บรรยาย",kind:"narration"}
  ]);
  assert.equal(clips[1].start, 2.6);
  assert.equal(clips[2].start, 5.6);
});
