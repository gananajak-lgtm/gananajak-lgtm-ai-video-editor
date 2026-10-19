export function computeMyCutImageCuts(
  lineStarts: number[],
  totalDuration: number,
  imageCount: number,
  cues: Array<number | null>
): number[] {
  if (!Number.isFinite(totalDuration) || totalDuration <= 0 ||
      !Number.isInteger(imageCount) || imageCount < 1 || imageCount > 500 ||
      !lineStarts.length || cues.length !== imageCount) {
    throw new Error("Invalid MyCut image cuts input");
  }
  if (lineStarts.some((time, index) => !Number.isFinite(time) ||
    time < 0 || time >= totalDuration ||
    (index > 0 && time <= lineStarts[index - 1]))) {
    throw new Error("Invalid voice line starts");
  }
  // Image one always begins at zero; a later voice-line cue cannot be honored.
  if (cues[0] !== null && cues[0] !== 0) {
    throw new Error("Conflicting storyboard line cue at image 1");
  }
  const lineCount = lineStarts.length;
  const cuts = [0];
  for (let index = 1; index < imageCount; index++) {
    const scaled = imageCount <= lineCount
      ? Math.ceil(index * lineCount / imageCount)
      : index * lineCount / imageCount;
    const lineIndex = Math.floor(scaled);
    const fraction = scaled - lineIndex;
    const start = lineStarts[lineIndex];
    const end = lineIndex + 1 < lineCount ? lineStarts[lineIndex + 1] : totalDuration;
    const proposal = start + (end - start) * fraction;
    const cue = cues[index];
    const pinned = cue === null ? proposal : lineStarts[cue];
    // A conflicting explicit cue is invalid; never silently relocate it.
    if (cue !== null && (!Number.isInteger(cue) || cue < 0 ||
      cue >= lineCount || pinned <= cuts[index - 1] || pinned >= totalDuration)) {
      throw new Error("Conflicting storyboard line cue at image " + (index + 1));
    }
    const safe = pinned;
    if (!(safe > cuts[index - 1] && safe < totalDuration)) {
      throw new Error("Storyboard cues result in an invalid image duration");
    }
    cuts.push(safe);
  }
  cuts.push(totalDuration);
  return cuts;
}

/** Read an optional 1-based line cue without silently discarding invalid references. */
export function parseMyCutStoryboardLineCue(caption: string, lineCount: number): number | null {
  const match = caption.match(/(?:^|\n)\s*(?:line|บรรทัด)\s*[:：=]\s*([^\r\n]*)/i);
  if (!match) return null;
  const value = match[1].trim();
  if (!/^\d+$/.test(value)) throw new Error("Invalid storyboard line cue");
  const oneBased = Number(value);
  if (!Number.isSafeInteger(oneBased) || oneBased < 1 || oneBased > lineCount) {
    throw new Error("Storyboard line cue is outside the episode voice lines");
  }
  return oneBased - 1;
}
