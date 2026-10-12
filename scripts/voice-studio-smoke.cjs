// Run with: node scripts/voice-studio-smoke.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const vm = require("node:vm");

function loadModule(file) {
  const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const exports = {};
  const context = { exports, require: (name) => { throw new Error("Unexpected runtime dependency: " + name); }, Date, JSON, Object, Array, Number };
  vm.runInNewContext(compiled, context, { filename: file });
  return exports;
}

const { parseNovelScript } = loadModule("src/renderer/novel-voice-parser.ts");
const { buildVoiceProductionPlan, voicePlanSummary } = loadModule("src/renderer/voice-production-plan.ts");
const { canScheduleWorkspaceJob, selectWorkspaceVoice } = loadModule("src/renderer/elevenlabs-workspace-profiles.ts");

const parsed = parseNovelScript('[SFX: เสียงฝนตก]\nป่าเงียบสงัด\n[พูด: พรานสิง | อารมณ์: กระซิบ] หยุดก่อน');
assert.equal(parsed.length, 3);
assert.equal(parsed[0].kind, "sfx");
assert.equal(parsed[0].text, "เสียงฝนตก");
assert.equal(parsed[1].kind, "narration");
assert.equal(parsed[2].speaker, "พรานสิง");

const longNarration = "บรรยายยาว ".repeat(90).trim();
const segmented = parseNovelScript(longNarration);
assert.ok(segmented.length > 1);
assert.ok(segmented.every(line => line.kind === "narration" && line.text.length <= 240));
assert.equal(segmented.map(line => line.text).join(" "), longNarration);

const labeled = parseNovelScript("[ผู้บรรยาย]\nป่ามืด\n\n[พรานสิง]\nอิน เอ็งได้ยินไหม\n\n[พรานอิน | อารมณ์: หวาดระแวง]\nได้ยินพี่\n\n[SFX] เสียงกิ่งไม้หัก");
assert.equal(labeled.length, 4);
assert.equal(labeled[0].kind, "narration");
assert.equal(labeled[1].speaker, "พรานสิง");
assert.equal(labeled[2].speaker, "พรานอิน");
assert.equal(labeled[2].emotion, "หวาดระแวง");
assert.equal(labeled[2].needsReview, false);
assert.equal(labeled[3].kind, "sfx");

// A blank line after a completed tagged passage ends attribution; untagged text requires review.
const spacedNarration = parseNovelScript("[ผู้บรรยาย]\nป่ามืด\n\nข้อความบรรยายต่อเนื่อง");
assert.equal(spacedNarration.length, 2);
assert.equal(spacedNarration[0].needsReview, false);
assert.equal(spacedNarration[1].speaker, "ผู้บรรยาย");
assert.equal(spacedNarration[1].needsReview, true);
const docxDialogue = parseNovelScript("[ผู้บรรยาย]\nกลางคืนของหมู่บ้าน\n\n[ลำดวน]\n\nพี่สิงห์\n\n[พรานสิง]\n\nอือ");
assert.equal(docxDialogue.length, 3);
assert.deepEqual(docxDialogue.map(line => line.speaker).join(","), "ผู้บรรยาย,ลำดวน,พรานสิง");
assert.equal(docxDialogue[1].text, "พี่สิงห์");
assert.equal(docxDialogue[1].needsReview, false);
// Regression: a completed labeled paragraph must not silently claim the next untagged one.
const untaggedAfterDialogue = parseNovelScript("[พรานสิง]\nหยุดก่อน\n\nเสียงฝีเท้าดังจากหลังต้นไม้");
assert.equal(untaggedAfterDialogue.length, 2);
assert.equal(untaggedAfterDialogue[0].speaker, "พรานสิง");
assert.equal(untaggedAfterDialogue[1].speaker, "ผู้บรรยาย");
assert.equal(untaggedAfterDialogue[1].needsReview, true);

// Regression: a label followed by a blank line is still valid for imported DOCX text.
const separatedTag = parseNovelScript("[พรานอิน]\n\nข้าได้ยินแล้ว");
assert.equal(separatedTag.length, 1);
assert.equal(separatedTag[0].speaker, "พรานอิน");
assert.equal(separatedTag[0].needsReview, false);

// Pure timeline pacing: speaker transitions and overrides never overlap audio.
const { scheduleDialogueClips, dialoguePause, DEFAULT_DIALOGUE_PACING } = loadModule("src/renderer/dialogue-timeline.ts");
const first = { lineId: "one", filePath: "one.mp3", duration: 2, speaker: "พรานสิง", text: "หยุดก่อน", kind: "dialogue", jobId: "voice-one", emotion: "กระซิบ" };
const second = { lineId: "two", filePath: "two.mp3", duration: 3, speaker: "พรานอิน", text: "ได้ยินแล้ว", kind: "dialogue" };
assert.equal(dialoguePause(first, second), DEFAULT_DIALOGUE_PACING.speakerChange);
const scheduled = scheduleDialogueClips([first, second]);
assert.equal(scheduled[0].end, 2);
assert.equal(scheduled[0].speaker, "พรานสิง");
assert.equal(scheduled[0].jobId, "voice-one");
assert.equal(scheduled[0].emotion, "กระซิบ");
assert.equal(scheduled[0].text, "หยุดก่อน");
assert.equal(scheduled[0].kind, "dialogue");
assert.equal(scheduled[1].speaker, "พรานอิน");
assert.equal(scheduled[1].start, 2 + DEFAULT_DIALOGUE_PACING.speakerChange);
const overridden = scheduleDialogueClips([{ ...first, pauseAfter: 1.25 }, second]);
assert.equal(overridden[1].start, 3.25);
assert.throws(() => scheduleDialogueClips([{ ...first, pauseAfter: -1 }, second]), /pause/i);

const legacyNarration = parseNovelScript("ข้อความไม่มีป้ายกำกับ");
assert.equal(legacyNarration[0].needsReview, false);

const unknown = parseNovelScript('“ใครอยู่ตรงนั้น”');
assert.equal(unknown[0].needsReview, true);
const planA = buildVoiceProductionPlan("ตอนที่ 1", parsed, { "ผู้บรรยาย": "narrator", "พรานสิง": "hunter" }, {}, "workspace-A");
const planB = buildVoiceProductionPlan("ตอนที่ 1", parsed, { "ผู้บรรยาย": "narrator", "พรานสิง": "hunter" }, {}, "workspace-B");
assert.equal(voicePlanSummary(planA).sfx, 1);
assert.equal(voicePlanSummary(planA).ready, 2);
assert.equal(planA.workspaceId, "workspace-A");
assert.equal(planA.jobs[0].workspaceId, "workspace-A");
assert.notEqual(planA.jobs[0].fingerprint, planB.jobs[0].fingerprint);
const planOtherModel = buildVoiceProductionPlan("ตอนที่ 1", parsed, { "ผู้บรรยาย": "narrator", "พรานสิง": "hunter" }, {}, "workspace-A", "eleven_flash_v2_5");
assert.equal(planA.modelId, "eleven_multilingual_v2");
assert.equal(planOtherModel.jobs[0].modelId, "eleven_flash_v2_5");
assert.notEqual(planA.jobs[0].fingerprint, planOtherModel.jobs[0].fingerprint);

// Cache reuse must invalidate when any synthesis input changes.
const { voiceFingerprint, reusableVoiceCache } = loadModule("src/renderer/voice-production-plan.ts");
const speech = { id: "line-1", kind: "dialogue", speaker: "พรานสิง", text: "หยุดก่อน", emotion: "กระซิบ", needsReview: false };
const cached = { "line-1": { fingerprint: voiceFingerprint(speech, "hunter", "workspace-A"), outputPath: "dialogue/line-1.mp3" } };
const withCache = (line, voice = "hunter", workspace = "workspace-A", model = "eleven_multilingual_v2") =>
  buildVoiceProductionPlan("ตอนที่ 1", [line], { [line.speaker]: voice }, cached, workspace, model);
const unchanged = withCache(speech);
assert.equal(unchanged.jobs[0].state, "completed");
assert.equal(voicePlanSummary(unchanged).estimatedCharacters, 0);
assert.equal(Object.keys(reusableVoiceCache(unchanged, cached)).length, 1);
for (const changed of [
  withCache({ ...speech, text: "หยุดเดี๋ยวนี้" }),
  withCache({ ...speech, emotion: "ตะโกน" }),
  withCache(speech, "different-voice"),
  withCache(speech, "workspace-B"),
  withCache(speech, "hunter", "workspace-A", "eleven_flash_v2_5")
]) {
  assert.equal(changed.jobs[0].state, "ready");
  assert.equal(changed.jobs[0].outputPath, undefined);
  assert.equal(Object.keys(reusableVoiceCache(changed, cached)).length, 0);
}
assert.equal(withCache({ ...speech, needsReview: true }).jobs[0].state, "blocked");
assert.equal(withCache(speech, "").jobs[0].state, "blocked");
assert.equal(withCache(speech, "hunter", "").jobs[0].state, "blocked");

const profile = { id: "workspace-A", label: "A", workspaceLabel: "A", enabled: true, keyReference: null, monthlyCreditBudget: 100, usedCredits: 90, voiceIds: { "พรานสิง": "hunter" } };
assert.equal(selectWorkspaceVoice([profile], "workspace-A", "พรานสิง").voiceId, "hunter");
assert.equal(canScheduleWorkspaceJob(profile, 11).allowed, false);
assert.equal(canScheduleWorkspaceJob(profile, 10).allowed, true);
assert.equal(canScheduleWorkspaceJob({ ...profile, usedCredits: null }, 0).allowed, false);
assert.equal(canScheduleWorkspaceJob({ ...profile, usedCredits: -1 }, 0).allowed, false);
assert.equal(canScheduleWorkspaceJob({ ...profile, monthlyCreditBudget: Number.NaN }, 0).allowed, false);
assert.equal(canScheduleWorkspaceJob({ ...profile, monthlyCreditBudget: -1 }, 0).allowed, false);
console.log("Voice Studio smoke checks passed");
