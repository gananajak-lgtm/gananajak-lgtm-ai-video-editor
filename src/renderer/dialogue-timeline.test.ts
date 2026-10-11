import { describe, expect, it } from "vitest";
import { scheduleDialogueClips } from "./dialogue-timeline";
describe("dialogue scheduling", () => {
  it("places clips sequentially without overlap", () => {
    expect(scheduleDialogueClips([{lineId:"1",filePath:"a.mp3",duration:2.5},{lineId:"2",filePath:"b.mp3",duration:3}],0.25))
      .toEqual([{lineId:"1",filePath:"a.mp3",duration:2.5,start:0,end:2.5},{lineId:"2",filePath:"b.mp3",duration:3,start:2.75,end:5.75}]);
  });
  it("rejects corrupt durations and duplicate lines", () => {
    expect(() => scheduleDialogueClips([{lineId:"1",filePath:"a",duration:NaN}])).toThrow();
    expect(() => scheduleDialogueClips([{lineId:"1",filePath:"a",duration:1},{lineId:"1",filePath:"b",duration:2}])).toThrow();
  });
});
