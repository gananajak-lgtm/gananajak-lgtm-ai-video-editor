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

const profile = { id: "workspace-A", label: "A", workspaceLabel: "A", enabled: true, keyReference: null, monthlyCreditBudget: 100, usedCredits: 90, voiceIds: { "พรานสิง": "hunter" } };
assert.equal(selectWorkspaceVoice([profile], "workspace-A", "พรานสิง").voiceId, "hunter");
assert.equal(canScheduleWorkspaceJob(profile, 11).allowed, false);
assert.equal(canScheduleWorkspaceJob(profile, 10).allowed, true);
assert.equal(canScheduleWorkspaceJob({ ...profile, usedCredits: null }, 0).allowed, false);
assert.equal(canScheduleWorkspaceJob({ ...profile, usedCredits: -1 }, 0).allowed, false);
assert.equal(canScheduleWorkspaceJob({ ...profile, monthlyCreditBudget: Number.NaN }, 0).allowed, false);
assert.equal(canScheduleWorkspaceJob({ ...profile, monthlyCreditBudget: -1 }, 0).allowed, false);
console.log("Voice Studio smoke checks passed");
