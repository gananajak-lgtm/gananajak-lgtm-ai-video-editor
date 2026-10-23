/** Deterministic still-frame hold planner. Anchors must be explicit, never inferred from image contents. */
export type VisualAnchor = { imageId: string; lineId: string };
export type TimedVoiceLine = { lineId: string; start: number; end: number };
export type HeldFrame = { imageId: string; start: number; end: number; anchorLineId: string };

/** A new image starts at its anchored voice line; the previous still remains visible until then. */
export function holdFramesThroughDialogue(lines: TimedVoiceLine[], anchors: VisualAnchor[]): HeldFrame[] {
  if (!lines.length || !anchors.length) return [];
  const seenLines = new Set<string>();
  let previousEnd = 0;
  for (const line of lines) {
    if (!line.lineId || seenLines.has(line.lineId) || !Number.isFinite(line.start) || !Number.isFinite(line.end) || line.start < previousEnd || line.end <= line.start) throw new Error("Invalid or overlapping voice schedule");
    seenLines.add(line.lineId);
    previousEnd = line.end;
  }
  const index = new Map(lines.map((line, i) => [line.lineId, i]));
  let lastIndex = -1;
  const seenImages = new Set<string>();
  const ordered = anchors.map(anchor => {
    const i = index.get(anchor.lineId);
    if (!anchor.imageId || seenImages.has(anchor.imageId) || i === undefined || i <= lastIndex) throw new Error("Image anchors must be unique and follow voice line order");
    seenImages.add(anchor.imageId);
    lastIndex = i;
    return { anchor, line: lines[i] };
  });
  if (ordered[0].line !== lines[0]) throw new Error("First image must anchor first voice line");
  return ordered.map(({ anchor, line }, i) => {
    const next = ordered[i + 1]?.line;
    const end = next ? next.start : lines[lines.length - 1].end;
    if (end <= line.start) throw new Error("Invalid image hold");
    return { imageId: anchor.imageId, anchorLineId: anchor.lineId, start: line.start, end };
  });
}

/** Preserve only string voice anchors belonging to stills in the loaded timeline. */
export function restoreFrameAnchors(value: unknown, clipIds: readonly string[], lineIds?: readonly string[]): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const allowed = new Set(clipIds);
  const validLines = lineIds ? new Set(lineIds) : null;
  return Object.fromEntries(
    Object.entries(value).filter(([id, lineId]) => allowed.has(id) && typeof lineId === "string" && lineId.length > 0 && (!validLines || validLines.has(lineId)))
  );
}
