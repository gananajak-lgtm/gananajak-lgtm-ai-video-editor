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
  const matches = [...caption.matchAll(/(?:^|\r?\n)[ \t]*(?:line|บรรทัด)[ \t]*[:：=][ \t]*([^\r\n]*)/gi)];
  if (!matches.length) return null;
  if (matches.length > 1) throw new Error("Duplicate storyboard line cues");
  const value = matches[0][1].trim();
  if (!/^\d+$/.test(value)) throw new Error("Invalid storyboard line cue");
  const oneBased = Number(value);
  if (!Number.isSafeInteger(oneBased) || oneBased < 1 || oneBased > lineCount) {
    throw new Error("Storyboard line cue is outside the episode voice lines");
  }
  return oneBased - 1;
}

/** Validate a gapless V1 cut plan before serializing any MyCut clips. */
export function assertMyCutContinuousVisualCuts(cuts: number[], totalDuration: number): void {
  if (!Array.isArray(cuts) || cuts.length < 2 ||
      !Number.isFinite(totalDuration) || totalDuration <= 0 ||
      cuts[0] !== 0 || cuts[cuts.length - 1] !== totalDuration ||
      cuts.some((cut, index) => !Number.isFinite(cut) ||
        (index > 0 && cut <= cuts[index - 1]))) {
    throw new Error("Invalid MyCut V1 continuity: image clips must cover the timeline without gaps");
  }
}

/** Assert A1 voice clips are sequential with exactly the requested inter-line silence. */
export function assertMyCutVoiceTimeline(
  starts: number[], durations: number[], totalDuration: number, gapSeconds = 0.3
): void {
  const tolerance = 1e-6;
  if (!starts.length || starts.length !== durations.length ||
      !Number.isFinite(totalDuration) || totalDuration <= 0 ||
      !Number.isFinite(gapSeconds) || gapSeconds < 0 ||
      starts.some(value => !Number.isFinite(value)) ||
      durations.some(value => !Number.isFinite(value) || value <= 0) ||
      Math.abs(starts[0]) > tolerance) {
    throw new Error("Invalid MyCut A1 voice timeline");
  }
  for (let i = 1; i < starts.length; i++) {
    const expected = starts[i - 1] + durations[i - 1] + gapSeconds;
    if (Math.abs(starts[i] - expected) > tolerance) {
      throw new Error("Invalid MyCut A1 voice gap at line " + (i + 1));
    }
  }
  if (Math.abs(starts[starts.length - 1] + durations[durations.length - 1] - totalDuration) > tolerance) {
    throw new Error("Invalid MyCut A1 end time");
  }
}

/** Build an explicit, read-only shot review plan; it does not modify MyCut projects. */
export function buildMyCutShotReview(
  imageNames: string[], cuts: number[], totalDuration: number
): Array<{ image: string; position: number; start: number; end: number; duration: number }> {
  if (!Array.isArray(imageNames) || !imageNames.length ||
      imageNames.length > 500 || cuts.length !== imageNames.length + 1 ||
      imageNames.some(name => typeof name !== "string" || !name.trim())) {
    throw new Error("Invalid MyCut shot review input");
  }
  assertMyCutContinuousVisualCuts(cuts, totalDuration);
  return imageNames.map((image, index) => ({
    image, position: index + 1, start: cuts[index], end: cuts[index + 1],
    duration: cuts[index + 1] - cuts[index]
  }));
}

/** Reorder a proposed shot list without modifying the source array or any project. */
export function moveMyCutReviewShot(
  images: string[], fromIndex: number, toIndex: number, lockedIndices: number[] = []
): string[] {
  if (!Array.isArray(images) || images.length < 1 || images.length > 500 ||
      images.some(image => typeof image !== "string" || !image.trim()) ||
      !Number.isInteger(fromIndex) || !Number.isInteger(toIndex) ||
      fromIndex < 0 || toIndex < 0 || fromIndex >= images.length || toIndex >= images.length ||
      !Array.isArray(lockedIndices) ||
      lockedIndices.some(index => !Number.isInteger(index) || index < 0 || index >= images.length)) {
    throw new Error("Invalid MyCut shot move");
  }
  const locks = new Set(lockedIndices);
  if (fromIndex === toIndex) return [...images];
  if (locks.has(fromIndex) || locks.has(toIndex) ||
      [...locks].some(index => index >= Math.min(fromIndex,toIndex) && index <= Math.max(fromIndex,toIndex))) {
    throw new Error("Cannot move a locked MyCut shot");
  }
  const result = [...images];
  const [moved] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, moved);
  return result;
}
