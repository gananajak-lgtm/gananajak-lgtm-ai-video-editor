/** Pure scheduling logic for verified dialogue MP3 clips. No network or paid API calls. */
export type DialogueClip = { lineId: string; filePath: string; duration: number; start: number; end: number };
export type DialogueSource = { lineId: string; filePath: string; duration: number };
export function scheduleDialogueClips(sources: DialogueSource[], gapSeconds = 0): DialogueClip[] {
  if (!Number.isFinite(gapSeconds) || gapSeconds < 0 || gapSeconds > 30) throw new Error("Invalid dialogue gap");
  const seen = new Set<string>();
  let cursor = 0;
  return sources.map(source => {
    if (!source.lineId || seen.has(source.lineId)) throw new Error("Duplicate or invalid dialogue line");
    if (!source.filePath || !Number.isFinite(source.duration) || source.duration <= 0) throw new Error("Invalid dialogue audio duration");
    seen.add(source.lineId);
    const start = cursor;
    const end = start + source.duration;
    if (!Number.isFinite(end)) throw new Error("Dialogue timeline exceeds supported duration");
    cursor = end + gapSeconds;
    return { ...source, start, end };
  });
}
