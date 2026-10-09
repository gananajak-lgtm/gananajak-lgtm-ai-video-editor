export type ElevenLabsWorkspaceProfile = {
  id: string;
  label: string;
  workspaceLabel: string;
  enabled: boolean;
  keyReference: string | null;
  monthlyCreditBudget: number | null;
  usedCredits: number | null;
  voiceIds: Record<string, string>;
};

export type WorkspaceSelection = {
  profileId: string;
  voiceId: string;
};

export function selectWorkspaceVoice(
  profiles: ElevenLabsWorkspaceProfile[],
  profileId: string,
  speaker: string
): WorkspaceSelection | null {
  const profile = profiles.find(item => item.id === profileId && item.enabled);
  if (!profile) return null;
  const voiceId = profile.voiceIds[speaker]?.trim();
  return voiceId ? { profileId: profile.id, voiceId } : null;
}

export function canScheduleWorkspaceJob(
  profile: ElevenLabsWorkspaceProfile | undefined,
  requestedCredits: number
): { allowed: boolean; reason?: string } {
  if (!profile || !profile.enabled) return { allowed: false, reason: "Workspace is not selected or disabled" };
  if (!Number.isFinite(requestedCredits) || requestedCredits < 0) return { allowed: false, reason: "Invalid estimated credit usage" };
  if (profile.monthlyCreditBudget === null || profile.usedCredits === null) return { allowed: false, reason: "Credit budget or usage is unknown" };
  if (profile.usedCredits + requestedCredits > profile.monthlyCreditBudget) return { allowed: false, reason: "Workspace budget exceeded" };
  return { allowed: true };
}

// A single explicit workspace selection is used for each job.
// Never rotate to another profile on quota exhaustion or provider failure.
