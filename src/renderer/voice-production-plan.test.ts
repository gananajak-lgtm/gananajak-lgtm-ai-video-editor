import assert from "node:assert/strict";
import test from "node:test";
import type { VoiceLine } from "./novel-voice-parser";
import { buildVoiceProductionPlan, reusableVoiceCache, voiceFingerprint, voicePlanSummary } from "./voice-production-plan";

const line: VoiceLine = { id: "line-1", kind: "dialogue", speaker: "สิงห์", text: "หยุดก่อน", emotion: "กระซิบ", needsReview: false };
const workspace = "workspace-A";
const voice = "voice-A";
const model = "eleven_multilingual_v2";
const path = "dialogue/line-1.mp3";
const fingerprint = voiceFingerprint(line, voice, workspace, model);
const cache = { [line.id]: { fingerprint, outputPath: path } };
const plan = (input: VoiceLine, voiceId = voice, workspaceId = workspace, modelId = model) =>
  buildVoiceProductionPlan("ตอน 1", [input], { [input.speaker]: voiceId }, cache, workspaceId, modelId);

test("reuses matching cached MP3 and excludes it from paid character estimate", () => {
  const result = plan(line);
  assert.equal(result.jobs[0].state, "completed");
  assert.equal(result.jobs[0].outputPath, path);
  assert.equal(voicePlanSummary(result).estimatedCharacters, 0);
  assert.deepEqual(reusableVoiceCache(result, cache), cache);
});

test("changes to speech text, emotion, voice, workspace or model invalidate cached MP3", () => {
  const cases = [
    plan({ ...line, text: "หยุดเดี๋ยวนี้" }),
    plan({ ...line, emotion: "ตะโกน" }),
    plan(line, "voice-B"),
    plan(line, voice, "workspace-B"),
    plan(line, voice, workspace, "eleven_turbo_v2_5")
  ];
  for (const result of cases) {
    assert.equal(result.jobs[0].state, "ready");
    assert.equal(result.jobs[0].outputPath, undefined);
    assert.equal(voicePlanSummary(result).estimatedCharacters, result.jobs[0].text.length);
    assert.deepEqual(reusableVoiceCache(result, cache), {});
  }
});

test("review-required line stays blocked even if fingerprint matches cached audio", () => {
  const result = plan({ ...line, needsReview: true });
  assert.equal(result.jobs[0].state, "blocked");
  assert.equal(voicePlanSummary(result).completed, 0);
});

test("missing voice or workspace cannot reuse cached audio", () => {
  for (const result of [plan(line, ""), plan(line, voice, "")]) {
    assert.equal(result.jobs[0].state, "blocked");
    assert.equal(voicePlanSummary(result).completed, 0);
  }
});

test("SFX cues are never sent to voice generation", () => {
  const sfx: VoiceLine = { id: "sfx-1", kind: "sfx", speaker: "", text: "เสียงฝน", emotion: "", needsReview: false };
  const result = buildVoiceProductionPlan("ตอน 1", [line, sfx], { [line.speaker]: voice }, cache, workspace);
  assert.equal(result.jobs.length, 1);
  assert.equal(result.sfxCues.length, 1);
});
