import assert from "node:assert/strict";
import test from "node:test";
import type { VoiceLine } from "./novel-voice-parser";
import { buildVoiceProductionPlan, prepareVoiceGeneration, reusableVoiceCache, voiceFingerprint, voicePlanSummary, validateVoiceProductionPlan } from "./voice-production-plan";

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

test("validates a ready queue without triggering paid generation", () => {
  const result = buildVoiceProductionPlan("ตอน 1", [line], { [line.speaker]: voice }, {}, workspace);
  assert.deepEqual(validateVoiceProductionPlan(result), []);
});

test("rejects malformed speaker, order and premature output path", () => {
  const result = buildVoiceProductionPlan("ตอน 1", [line], { [line.speaker]: voice }, {}, workspace);
  result.jobs[0].speaker = "";
  result.jobs[0].order = -1;
  result.jobs[0].outputPath = "dialogue/unverified.mp3";
  const errors = validateVoiceProductionPlan(result);
  assert.ok(errors.some(error => error.includes("ผู้พูด")));
  assert.ok(errors.some(error => error.includes("ลำดับ")));
  assert.ok(errors.some(error => error.includes("ยังสร้างไม่เสร็จ")));
});

test("rejects duplicate line IDs and modified fingerprints", () => {
  const result = buildVoiceProductionPlan("ตอน 1", [line], { [line.speaker]: voice }, {}, workspace);
  result.jobs.push({ ...result.jobs[0], id: "voice-other", text: "ข้อความถูกเปลี่ยน" });
  const errors = validateVoiceProductionPlan(result);
  assert.ok(errors.some(error => error.includes("รหัสบรรทัดซ้ำ")));
  assert.ok(errors.some(error => error.includes("รหัสตรวจสอบ")));
});

test("preflight sends only uncached lines and counts only payable characters", () => {
  const next: VoiceLine = { ...line, id: "line-2", text: "กลับไปก่อน" };
  const result = buildVoiceProductionPlan("ตอน 1", [line, next], { [line.speaker]: voice }, cache, workspace);
  const preflight = prepareVoiceGeneration(result);
  assert.equal(preflight.canGenerate, true);
  assert.deepEqual(preflight.pending.map(job => job.lineId), ["line-2"]);
  assert.deepEqual(preflight.reused.map(job => job.lineId), ["line-1"]);
  assert.equal(preflight.estimatedCharacters, next.text.length);
  assert.deepEqual(preflight.errors, []);
});

test("preflight blocks invalid queues without returning payable jobs", () => {
  const result = buildVoiceProductionPlan("ตอน 1", [line], {}, {}, workspace);
  const preflight = prepareVoiceGeneration(result);
  assert.equal(preflight.canGenerate, false);
  assert.deepEqual(preflight.pending, []);
  assert.equal(preflight.estimatedCharacters, 0);
  assert.ok(preflight.errors.length > 0);
});

test("preflight refuses in-progress jobs to prevent duplicate paid calls", () => {
  const result = buildVoiceProductionPlan("ตอน 1", [line], { [line.speaker]: voice }, {}, workspace);
  result.jobs[0].state = "generating";
  const preflight = prepareVoiceGeneration(result);
  assert.equal(preflight.canGenerate, false);
  assert.deepEqual(preflight.pending, []);
  assert.equal(preflight.estimatedCharacters, 0);
  assert.ok(preflight.errors.length > 0);
});

test("preflight with all cached lines needs no paid generation", () => {
  const preflight = prepareVoiceGeneration(plan(line));
  assert.equal(preflight.canGenerate, false);
  assert.equal(preflight.estimatedCharacters, 0);
  assert.equal(preflight.reused.length, 1);
  assert.deepEqual(preflight.errors, []);
});
