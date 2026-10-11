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
export function validateVoiceProductionPlan(plan: VoiceProductionPlan): string[] {
  const errors: string[] = [];
  if (plan.schemaVersion !== 1 || plan.provider !== "elevenlabs" || plan.requiresExplicitApproval !== true) {
    errors.push("รูปแบบคิวสร้างเสียงไม่ถูกต้องหรือไม่มีข้อกำหนดการอนุมัติ");
  }
  if (!plan.workspaceId?.trim()) errors.push("ยังไม่ได้เลือก ElevenLabs Workspace");
  if (!plan.modelId?.trim()) errors.push("ยังไม่ได้ระบุโมเดลเสียง");
  if (!Array.isArray(plan.jobs) || plan.jobs.length > 10000) {
    errors.push("จำนวนงานสร้างเสียงไม่ถูกต้อง");
    return errors;
  }
  const seen = new Set<string>();
  for (const job of plan.jobs) {
    if (!job.id || seen.has(job.id)) errors.push("พบรหัสงานซ้ำหรือว่าง");
    seen.add(job.id);
    if (job.workspaceId !== plan.workspaceId || job.modelId !== plan.modelId) errors.push(`งาน ${job.id} ใช้ Workspace หรือโมเดลไม่ตรงกับคิว`);
    if (job.state === "blocked" || !job.voiceId?.trim() || !job.text.trim()) errors.push(`งาน ${job.id} ยังไม่พร้อมสร้างเสียง`);
    if (job.fingerprint !== JSON.stringify([job.text.trim(), job.emotion.trim(), job.voiceId?.trim() || "", job.workspaceId?.trim() || "", job.modelId.trim()])) {
      errors.push(`งาน ${job.id} มีข้อมูลเปลี่ยนจากรหัสตรวจสอบ`);
    }
  }
  return errors;
}
