/**
 * Offline script-to-voice alignment. This reads stored ElevenLabs metadata,
 * NEVER synthesizes or transcribes speech, and never mutates MP3s.
 * Ambiguous/missing text is returned for review instead of being guessed.
 */
export type SavedVoiceForAlignment = { lineId: string; text: string; speaker?: string };
export type ScriptVoiceMatch = { lineId: string; start: number; end: number; confidence: "exact" | "normalized" };
export type ScriptVoiceAlignment = {
  orderedLineIds: string[];
  matched: ScriptVoiceMatch[];
  unmatchedLineIds: string[];
  scriptLength: number;
  complete: boolean;
};
function normalizedWithOffset(source: string): { value: string; offsets: number[] } {
  let value = "";
  const offsets: number[] = [];
  for (let i = 0; i < source.length; i++) {
    const normalized = source[i].normalize("NFKC").toLocaleLowerCase();
    for (const char of normalized) {
      if (/\s|[“”"'‘’\[\]{}():：|,，.!?！？。…]/u.test(char)) continue;
      value += char;
      offsets.push(i);
    }
  }
  return { value, offsets };
}
export function alignSavedVoicesToScript(
  script: string,
  voices: SavedVoiceForAlignment[]
): ScriptVoiceAlignment {
  if (typeof script !== "string" || script.length > 2_000_000 ||
    !Array.isArray(voices) || voices.length > 10000) throw new Error("Invalid alignment request");
  const full = normalizedWithOffset(script);
  const used: Array<[number, number]> = [];
  const matched: ScriptVoiceMatch[] = [];
  const unmatchedLineIds: string[] = [];
  const seen = new Set<string>();
  for (const item of voices) {
    if (!item || typeof item.lineId !== "string" || !item.lineId ||
      seen.has(item.lineId) || typeof item.text !== "string") throw new Error("Invalid voice record");
    seen.add(item.lineId);
    const needle = normalizedWithOffset(item.text).value;
    // Short identical words are too ambiguous to auto-align safely.
    if (needle.length < 8 || !full.value) { unmatchedLineIds.push(item.lineId); continue; }
    const candidates: Array<{ start: number; end: number }> = [];
    let cursor = 0;
    while (cursor <= full.value.length - needle.length) {
      const at = full.value.indexOf(needle, cursor);
      if (at < 0) break;
      const end = at + needle.length;
      if (!used.some(([left, right]) => at < right && end > left)) candidates.push({ start: at, end });
      cursor = at + 1;
      if (candidates.length > 1) break;
    }
    if (candidates.length !== 1) { unmatchedLineIds.push(item.lineId); continue; }
    const candidate = candidates[0];
    used.push([candidate.start, candidate.end]);
    matched.push({
      lineId: item.lineId,
      start: full.offsets[candidate.start],
      end: full.offsets[candidate.end - 1] + 1,
      confidence: "normalized"
    });
  }
  matched.sort((a, b) => a.start - b.start || a.end - b.end);
  return {
    orderedLineIds: matched.map(item => item.lineId),
    matched, unmatchedLineIds, scriptLength: script.length,
    complete: unmatchedLineIds.length === 0 && matched.length > 0
  };
}
