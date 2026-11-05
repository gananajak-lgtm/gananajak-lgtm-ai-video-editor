/** Pure planning for bounded combined narration MP3 files.
 * Line timestamps are retained for shot alignment even after A1 is compacted.
 */
export type SegmentSource = { lineId: string; audio: string; duration: number };
export type SegmentPlan = { index: number; start: number; duration: number; sources: SegmentSource[]; leadingPause: number };
export function planNarrationSegments(
  lines: SegmentSource[], gapSeconds = 0.8, maxSeconds = 179, maxFiles = 80
): { segments: SegmentPlan[]; lineStarts: number[]; duration: number } {
  if (!Number.isFinite(gapSeconds) || gapSeconds < 0 || gapSeconds > 10 ||
      !Number.isFinite(maxSeconds) || maxSeconds <= 0 || maxSeconds > 180 ||
      !Number.isInteger(maxFiles) || maxFiles < 1 || maxFiles > 100) {
    throw new Error("Invalid narration segment settings");
  }
  const ids = new Set<string>();
  const segments: SegmentPlan[] = [];
  const lineStarts: number[] = [];
  let current: SegmentPlan | null = null;
  let elapsed = 0;
  for (const line of lines) {
    if (!line.lineId || !line.audio || ids.has(line.lineId) ||
        !Number.isFinite(line.duration) || line.duration <= 0) throw new Error("Invalid narration source");
    ids.add(line.lineId);
    const pause = lineStarts.length ? gapSeconds : 0;
    if (line.duration + pause > maxSeconds + 1e-7) {
      throw new Error("Voice line is too long for a three-minute segment: " + line.lineId);
    }
    const addToCurrent = current !== null &&
      current.sources.length < maxFiles &&
      current.duration + pause + line.duration <= maxSeconds + 1e-7;
    if (!addToCurrent) {
      if (current) segments.push(current);
      current = { index: segments.length, start: elapsed, duration: 0, sources: [], leadingPause: pause };
    }
    if (!current) throw new Error("Narration segment initialization failed");
    current.duration += pause + line.duration;
    lineStarts.push(elapsed + pause);
    elapsed += pause + line.duration;
    current.sources.push(line);
  }
  if (current) segments.push(current);
  return { segments, lineStarts, duration: elapsed };
}
