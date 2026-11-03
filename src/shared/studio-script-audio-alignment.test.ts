import test from "node:test";
import assert from "node:assert/strict";
import { alignSavedVoicesToScript } from "./studio-script-audio-alignment";

test("voice clips generated in scrambled batches align to the narrative", () => {
  const script = 'สายลมพัดเหนือหลังคา\n[พูด: พรานอิน] เราต้องรีบเดินทางก่อนฟ้าสาง\n[ผู้บรรยาย] ทั้งสองเดินหายเข้าไปในป่า';
  const result = alignSavedVoicesToScript(script, [
    { lineId: "take-b-line-1", text: "ทั้งสองเดินหายเข้าไปในป่า" },
    { lineId: "take-a-line-2", text: "เราต้องรีบเดินทางก่อนฟ้าสาง" },
    { lineId: "take-a-line-1", text: "สายลมพัดเหนือหลังคา" }
  ]);
  assert.equal(result.complete, true);
  assert.deepEqual(result.orderedLineIds, ["take-a-line-1","take-a-line-2","take-b-line-1"]);
  assert.equal(result.unmatchedLineIds.length, 0);
});

test("missing text is reported instead of silently assigning an arbitrary position", () => {
  const result = alignSavedVoicesToScript("พระจันทร์ส่องผ่านทิวไม้", [
    { lineId: "one", text: "พระจันทร์ส่องผ่านทิวไม้" },
    { lineId: "two", text: "เสียงมาจากคนละตอน" }
  ]);
  assert.deepEqual(result.orderedLineIds, ["one"]);
  assert.deepEqual(result.unmatchedLineIds, ["two"]);
  assert.equal(result.complete, false);
});

test("ambiguous repeated passages require review", () => {
  const phrase = "เจ้ากลับมาแล้วจริงหรือ";
  const result = alignSavedVoicesToScript(phrase + "\n" + phrase, [{ lineId: "one", text: phrase }]);
  assert.equal(result.complete, false);
  assert.deepEqual(result.unmatchedLineIds, ["one"]);
});

test("speaker labels and whitespace do not disrupt matching", () => {
  const text = "[พูด: พรานสิง]  ข้ารู้แล้วว่าใครอยู่เบื้องหลัง!";
  const result = alignSavedVoicesToScript(text, [{ lineId: "one", text: "ข้ารู้แล้วว่าใครอยู่เบื้องหลัง" }]);
  assert.equal(result.complete, true);
});
