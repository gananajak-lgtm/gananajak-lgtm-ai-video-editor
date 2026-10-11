import type { VoiceLine } from "./novel-voice-parser";

export type VoiceJobState = "blocked" | "ready" | "queued" | "generating" | "completed" | "failed";
export type VoiceJob = {
  id: string;
  lineId: string;
  order: number;
  speaker: string;
  text: string;
  emotion: string;
  voiceId: string | null;
  modelId: string;
  workspaceId: string | null;
  state: VoiceJobState;
  reason?: string;
  fingerprint: string;
  outputPath?: string;
};

export type VoiceProductionPlan = {
  schemaVersion: 1;
  title: string;
  createdAt: string;
  provider: "elevenlabs";
  workspaceId: string | null;
  modelId: string;
  requiresExplicitApproval: true;
  jobs: VoiceJob[];
  sfxCues: Array<{ lineId: string; text: string; order: number }>;
};

export function voiceFingerprint(line: VoiceLine, voiceId: string, workspaceId = "", modelId = "eleven_multilingual_v2"): string {
  // Deterministic local comparison key; no secrets or API keys included.
  return JSON.stringify([line.text.trim(), line.emotion.trim(), voiceId.trim(), workspaceId.trim(), modelId.trim()]);
}

export function buildVoiceProductionPlan(
  title: string,
  lines: VoiceLine[],
  voiceIds: Record<string, string>,
  completed: Record<string, { fingerprint: string; outputPath: string }> = {},
  workspaceId: string | null = null,
  modelId = "eleven_multilingual_v2"
): VoiceProductionPlan {
  const jobs: VoiceJob[] = [];
  const sfxCues: VoiceProductionPlan["sfxCues"] = [];
  lines.forEach((line, order) => {
    if (line.kind === "sfx") {
      sfxCues.push({ lineId: line.id, text: line.text, order });
      return;
    }
    const voiceId = voiceIds[line.speaker]?.trim() || null;
    const fingerprint = voiceFingerprint(line, voiceId || "", workspaceId || "", modelId);
    const cached = completed[line.id];
    const reason = !line.text.trim() ? "บทพูดว่าง" : line.needsReview ? "ยังไม่ยืนยันผู้พูด" : !voiceId ? "ยังไม่ได้กำหนด Voice ID" : !workspaceId ? "ยังไม่ได้เลือก Workspace" : undefined;
    jobs.push({
      id: `voice-${line.id}`,
      lineId: line.id,
      order,
      speaker: line.speaker,
      text: line.text,
      emotion: line.emotion,
      voiceId,
      modelId,
      workspaceId,
      state: reason ? "blocked" : cached?.fingerprint === fingerprint && cached.outputPath ? "completed" : "ready",
      ...(reason ? { reason } : {}),
      fingerprint,
      ...(cached?.fingerprint === fingerprint && cached.outputPath ? { outputPath: cached.outputPath } : {})
    });
  });
  return { schemaVersion: 1, title, createdAt: new Date().toISOString(), provider: "elevenlabs", workspaceId, modelId, requiresExplicitApproval: true, jobs, sfxCues };
}

export function voicePlanSummary(plan: VoiceProductionPlan) {
  return {
    total: plan.jobs.length,
    blocked: plan.jobs.filter(job => job.state === "blocked").length,
    ready: plan.jobs.filter(job => job.state === "ready").length,
    completed: plan.jobs.filter(job => job.state === "completed").length,
    sfx: plan.sfxCues.length,
    estimatedCharacters: plan.jobs.filter(job => job.state === "ready").reduce((sum, job) => sum + job.text.length, 0)
  };
}


/**
 * Validate an offline queue before any future paid generation step.
 * Importing or validating a plan never calls ElevenLabs.
 */
export type CompletedVoiceCache = Record<string, { fingerprint: string; outputPath: string }>;

/**
 * Accept cached audio only when its complete synthesis fingerprint matches.
 * The caller must separately verify that each output file still exists on disk.
 */
export function reusableVoiceCache(plan: VoiceProductionPlan, cache: CompletedVoiceCache): CompletedVoiceCache {
  const reusable: CompletedVoiceCache = {};
  for (const job of plan.jobs) {
    const entry = cache[job.lineId];
    if (entry && entry.fingerprint === job.fingerprint && typeof entry.outputPath === "string" && entry.outputPath.trim()) {
      reusable[job.lineId] = { fingerprint: entry.fingerprint, outputPath: entry.outputPath };
    }
  }
  return reusable;
}

/**
 * Validate an untrusted offline queue before any future paid generation step.
 * No network calls or credit usage occur here.
 */
export function validateVoiceProductionPlan(plan: VoiceProductionPlan): string[] {
  const errors: string[] = [];
  if (!plan || typeof plan !== "object") return ["ข้อมูลคิวสร้างเสียงไม่ถูกต้อง"];
  if (plan.schemaVersion !== 1 || plan.provider !== "elevenlabs" || plan.requiresExplicitApproval !== true) {
    errors.push("รูปแบบคิวสร้างเสียงไม่ถูกต้องหรือไม่มีข้อกำหนดการอนุมัติ");
  }
  if (typeof plan.workspaceId !== "string" || !plan.workspaceId.trim()) errors.push("ยังไม่ได้เลือก ElevenLabs Workspace");
  if (typeof plan.modelId !== "string" || !plan.modelId.trim()) errors.push("ยังไม่ได้ระบุโมเดลเสียง");
  if (!Array.isArray(plan.jobs) || plan.jobs.length > 10000) {
    errors.push("จำนวนงานสร้างเสียงไม่ถูกต้อง");
    return errors;
  }
  const ids = new Set<string>();
  const lineIds = new Set<string>();
  for (const item of plan.jobs) {
    if (!item || typeof item !== "object") {
      errors.push("พบงานสร้างเสียงที่มีรูปแบบไม่ถูกต้อง");
      continue;
    }
    const job = item as VoiceJob;
    if (typeof job.id !== "string" || !job.id.trim() || ids.has(job.id)) errors.push("พบรหัสงานซ้ำหรือว่าง");
    else ids.add(job.id);
    if (typeof job.lineId !== "string" || !job.lineId.trim() || lineIds.has(job.lineId)) errors.push(`งาน ${String(job.id)} มีรหัสบรรทัดซ้ำหรือว่าง`);
    else lineIds.add(job.lineId);
    if (job.workspaceId !== plan.workspaceId || job.modelId !== plan.modelId) errors.push(`งาน ${String(job.id)} ใช้ Workspace หรือโมเดลไม่ตรงกับคิว`);
    if (typeof job.voiceId !== "string" || !job.voiceId.trim() || typeof job.text !== "string" || !job.text.trim() || job.state === "blocked") {
      errors.push(`งาน ${String(job.id)} ยังไม่พร้อมสร้างเสียง`);
    }
    if (!["ready", "queued", "generating", "completed", "failed"].includes(job.state)) errors.push(`งาน ${String(job.id)} มีสถานะไม่ถูกต้อง`);
    if (typeof job.emotion !== "string" || typeof job.modelId !== "string" || typeof job.workspaceId !== "string" || typeof job.voiceId !== "string" || typeof job.text !== "string") {
      errors.push(`งาน ${String(job.id)} มีข้อมูลสำหรับสร้างเสียงไม่ครบ`);
      continue;
    }
    const expected = JSON.stringify([job.text.trim(), job.emotion.trim(), job.voiceId.trim(), job.workspaceId.trim(), job.modelId.trim()]);
    if (job.fingerprint !== expected) errors.push(`งาน ${String(job.id)} มีข้อมูลเปลี่ยนจากรหัสตรวจสอบ`);
    if (job.state === "completed" && (typeof job.outputPath !== "string" || !job.outputPath.trim())) errors.push(`งาน ${String(job.id)} ไม่มีตำแหน่งไฟล์เสียง`);
  }
  return errors;
}
