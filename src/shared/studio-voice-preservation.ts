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

/** Sort older line-n audio first; later scoped chunks follow in creation order,
 * with each chunk's local lines in numeric order (not interleaved line-1s).
 */
export function compareVoiceChunkOrder(first: string, second: string): number {
  const key = (id: string): [number, string, number] => {
    const scoped = id.match(/^(take-[a-z0-9]+-[a-f0-9]{8})-line-(\\d+)$/i);
    if (scoped) return [1, scoped[1], Number(scoped[2])];
    const legacy = id.match(/^line-(\\d+)$/i);
    if (legacy) return [0, "", Number(legacy[1])];
    // Preserve relative insertion order for historical archived aliases.
    return [2, "", 0];
  };
  const a = key(first), b = key(second);
  return a[0] - b[0] || a[1].localeCompare(b[1]) || a[2] - b[2];
}
