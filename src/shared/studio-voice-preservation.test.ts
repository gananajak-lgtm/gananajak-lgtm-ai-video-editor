import test from "node:test";
import assert from "node:assert/strict";
import { compareVoiceChunkOrder, mergeVoiceAudioWithoutLoss, scopeVoiceLineIds } from "./studio-voice-preservation";

test("a second 5000-character chunk cannot reuse the first chunk's line keys", () => {
  const first = scopeVoiceLineIds([{ id: "line-1" }, { id: "line-2" }], "take-mh2q0000-1234abcd");
  const second = scopeVoiceLineIds([{ id: "line-1" }, { id: "line-2" }], "take-mh2q0001-1234abcd");
  assert.equal(first[0].id, "take-mh2q0000-1234abcd-line-1");
  assert.equal(second[0].id, "take-mh2q0001-1234abcd-line-1");
  assert.equal(new Set([...first, ...second].map(x => x.id)).size, 4);
});

test("a legacy colliding line id archives the original MP3 instead of removing it", () => {
  const original = { "line-1": { fingerprint: "voice-first", outputPath: "dialogue/line-1.mp3" } };
  const updated = mergeVoiceAudioWithoutLoss(
    original, "line-1",
    { fingerprint: "voice-second", outputPath: "dialogue/line-1-batch2.mp3" },
    "saved-1234abcd"
  );
  assert.deepEqual(updated["saved-1234abcd"], original["line-1"]);
  assert.equal(updated["line-1"].fingerprint, "voice-second");
  assert.equal(original["line-1"].fingerprint, "voice-first");
});

test("identical completed line is not duplicated and archive collisions fail closed", () => {
  const original = { "line-1": { fingerprint: "same", outputPath: "dialogue/existing.mp3" } };
  const same = mergeVoiceAudioWithoutLoss(original, "line-1", original["line-1"], "saved-new");
  assert.deepEqual(same, original);
  assert.throws(
    () => mergeVoiceAudioWithoutLoss({ ...original, "saved-new": original["line-1"] }, "line-1",
      { fingerprint: "different", outputPath: "dialogue/other.mp3" }, "saved-new"),
    /Invalid voice archive key/
  );
});

test("MyCut keeps multiple chunks sequential without interleaving line-1", () => {
  const ids = ["take-mh2q0002-1234abcd-line-2", "take-mh2q0001-1234abcd-line-2",
    "take-mh2q0002-1234abcd-line-1", "take-mh2q0001-1234abcd-line-1",
    "line-2", "line-1"];
  assert.deepEqual(ids.sort(compareVoiceChunkOrder), [
    "line-1", "line-2",
    "take-mh2q0001-1234abcd-line-1", "take-mh2q0001-1234abcd-line-2",
    "take-mh2q0002-1234abcd-line-1", "take-mh2q0002-1234abcd-line-2"
  ]);
});
