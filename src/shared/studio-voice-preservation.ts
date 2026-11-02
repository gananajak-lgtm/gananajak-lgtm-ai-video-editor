/** Preserve every paid MP3 when script chunks reuse line-1, line-2, etc.
 * Pure helper: caller separately validates paths and serializes writes.
 */
export function mergeVoiceAudioWithoutLoss<T extends { fingerprint: string; outputPath: string }>(
  existing: Record<string, T>, lineId: string, next: T, archiveId: string
): Record<string, T> {
  if (!lineId || !archiveId || lineId === archiveId || Object.prototype.hasOwnProperty.call(existing, archiveId)) {
    throw new Error("Invalid voice archive key");
  }
  const merged: Record<string, T> = { ...existing };
  const old = merged[lineId];
  if (old && (old.fingerprint !== next.fingerprint || old.outputPath !== next.outputPath)) {
    merged[archiveId] = old;
  }
  merged[lineId] = next;
  return merged;
}

/** One namespace per new script chunk, preserving local line order within it. */
export function scopeVoiceLineIds<T extends { id: string }>(lines: T[], namespace: string): T[] {
  if (!/^take-[a-z0-9]+-[a-f0-9]{8}$/i.test(namespace)) throw new Error("Invalid script chunk namespace");
  return lines.map(line => ({ ...line, id: namespace + "-" + line.id }));
}
