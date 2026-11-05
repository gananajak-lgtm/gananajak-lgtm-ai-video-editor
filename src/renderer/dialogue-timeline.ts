/** Timed MP3 dialogue placement. Pure scheduling; never invokes a paid voice provider. */
export type DialogueClip = { lineId: string; filePath: string; duration: number; start: number; end: number; speaker?: string; text?: string; kind?: "dialogue" | "narration"; sceneBreak?: boolean; jobId?: string; emotion?: string };
export type DialogueSource = { lineId: string; filePath: string; duration: number; speaker?: string; text?: string; kind?: "dialogue" | "narration"; sceneBreak?: boolean; pauseAfter?: number; jobId?: string; emotion?: string };
export type DialoguePacing = { sameSpeaker: number; speakerChange: number; sentenceEnd: number; narrationChange: number; sceneBreak: number };
export const DEFAULT_DIALOGUE_PACING: DialoguePacing = {
  sameSpeaker: 0.3, speakerChange: 0.6, sentenceEnd: 0.8, narrationChange: 1, sceneBreak: 1.5
};
export function dialoguePause(previous: DialogueSource, next: DialogueSource, pacing: DialoguePacing = DEFAULT_DIALOGUE_PACING): number {
  if (next.sceneBreak) return pacing.sceneBreak;
  if (previous.kind && next.kind && previous.kind !== next.kind) return pacing.narrationChange;
  if (previous.speaker && next.speaker && previous.speaker !== next.speaker) return pacing.speakerChange;
  if (previous.text && /[.!?。！？…]\s*$/.test(previous.text)) return pacing.sentenceEnd;
  return pacing.sameSpeaker;
}
export function scheduleDialogueClips(sources: DialogueSource[], gapSeconds: number | DialoguePacing = DEFAULT_DIALOGUE_PACING): DialogueClip[] {
  const pacing = typeof gapSeconds === "number" ? null : gapSeconds;
  const gaps: number[] = typeof gapSeconds === "number" ? [gapSeconds] : Object.values(gapSeconds);
  if (gaps.some(gap => !Number.isFinite(gap) || gap < 0 || gap > 30)) throw new Error("Invalid dialogue gap");
  const seen = new Set<string>();
  let cursor = 0;
  return sources.map((source, index) => {
    if (!source.lineId || seen.has(source.lineId)) throw new Error("Duplicate or invalid dialogue line");
    if (!source.filePath || !Number.isFinite(source.duration) || source.duration <= 0) throw new Error("Invalid dialogue audio duration");
    if (source.pauseAfter !== undefined && (!Number.isFinite(source.pauseAfter) || source.pauseAfter < 0 || source.pauseAfter > 30)) throw new Error("Invalid dialogue pause override");
    seen.add(source.lineId);
    const start = cursor;
    const end = start + source.duration;
    if (!Number.isFinite(end)) throw new Error("Dialogue timeline exceeds supported duration");
    if (index + 1 < sources.length) {
      const gap = source.pauseAfter ?? (pacing ? dialoguePause(source, sources[index + 1], pacing) : gapSeconds as number);
      cursor = end + gap;
    }
    return { lineId: source.lineId, filePath: source.filePath, duration: source.duration, start, end, ...(source.speaker !== undefined ? { speaker: source.speaker } : {}), ...(source.text !== undefined ? { text: source.text } : {}), ...(source.kind !== undefined ? { kind: source.kind } : {}), ...(source.sceneBreak !== undefined ? { sceneBreak: source.sceneBreak } : {}), ...(source.jobId !== undefined ? { jobId: source.jobId } : {}), ...(source.emotion !== undefined ? { emotion: source.emotion } : {}) };
  });
}
