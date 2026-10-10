export type VoiceLine = {
  id: string;
  text: string;
  speaker: string;
  emotion: string;
  kind: "narration" | "dialogue" | "sfx";
  needsReview: boolean;
};

const tagPattern = /^\[(บรรยาย|พูด|SFX)(?:\s*:\s*([^|\]]+))?(?:\s*\|\s*อารมณ์\s*:\s*([^\]]+))?\]\s*(.*)$/i;
const quotePattern = /"([^"]*)"|“([^”]*)”/g;
const narration = "ผู้บรรยาย";

export function parseNovelScript(script: string): VoiceLine[] {
  const result: VoiceLine[] = [];
  let activeTag: { speaker: string; emotion: string; kind: VoiceLine["kind"] } | null = null;
  let previousSpeaker: string | null = null;
  const strictLabels = script.split(/\r?\n/).some(line => /^\s*\[[^\]\r\n|:]{1,100}(?:\s*\|\s*อารมณ์\s*:\s*[^\]]+)?\]/.test(line));
  const push = (text: string, speaker: string, emotion: string, kind: VoiceLine["kind"], needsReview = false) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    // Keep narration manageable for TTS without rewriting or dropping source text.
    const segments: string[] = [];
    if (kind !== "narration" || trimmed.length <= 240) segments.push(trimmed);
    else {
      let remaining = trimmed;
      while (remaining.length > 240) {
        const prefix = remaining.slice(0, 240);
        const candidates = [...prefix.matchAll(/[.!?。！？…]+\s*|\s+/g)];
        const preferred = candidates.map(match => (match.index || 0) + match[0].length).filter(pos => pos >= 100 && pos <= 240);
        const cut = preferred.length ? preferred[preferred.length - 1] : 240;
        segments.push(remaining.slice(0, cut).trim());
        remaining = remaining.slice(cut).trim();
      }
      if (remaining) segments.push(remaining);
    }
    for (const segment of segments) if (segment) result.push({ id: `line-${result.length + 1}`, text: segment, speaker, emotion, kind, needsReview });
  };
  for (const paragraph of script.split(/\r?\n/)) {
    const line = paragraph.trim();
    if (!line) { activeTag = null; continue; }
    const named = line.match(/^\[([^\]\r\n|:]{1,100})(?:\s*\|\s*อารมณ์\s*:\s*([^\]]+))?\]\s*(.*)$/);
    if (named && !/^(บรรยาย|พูด|SFX)$/i.test(named[1].trim())) {
      const name = named[1].trim();
      const kind: VoiceLine["kind"] = name === "ผู้บรรยาย" ? "narration" : "dialogue";
      activeTag = { speaker: kind === "narration" ? narration : name, emotion: named[2]?.trim() || "ปกติ", kind };
      if (kind === "dialogue") previousSpeaker = name;
      if (named[3]) push(named[3], activeTag.speaker, activeTag.emotion, kind);
      continue;
    }
    const tag = line.match(tagPattern);
    if (tag) {
      const kind: VoiceLine["kind"] = tag[1].toLowerCase() === "sfx" ? "sfx" : tag[1] === "พูด" ? "dialogue" : "narration";
      activeTag = { kind, speaker: kind === "dialogue" ? (tag[2]?.trim() || "ไม่ทราบผู้พูด") : narration, emotion: tag[3]?.trim() || "ปกติ" };
      if (kind === "dialogue" && tag[2]) previousSpeaker = activeTag.speaker;
      if (kind === "sfx") {
        const cue = [tag[2], tag[4]].filter(Boolean).join(" ").trim();
        if (cue) push(cue, narration, activeTag.emotion, "sfx");
        activeTag = cue ? null : activeTag;
      } else if (tag[4]) push(tag[4], activeTag.speaker, activeTag.emotion, kind, kind === "dialogue" && !tag[2]);
      continue;
    }
    if (activeTag) {
      push(line, activeTag.speaker, activeTag.emotion, activeTag.kind, activeTag.kind === "dialogue" && activeTag.speaker === "ไม่ทราบผู้พูด");
      continue;
    }
    const quotes = [...line.matchAll(quotePattern)];
    if (!quotes.length) { push(line, narration, "ปกติ", "narration", strictLabels); continue; }
    let cursor = 0;
    for (const quote of quotes) {
      const start = quote.index ?? cursor;
      const before = line.slice(cursor, start);
      if (before.trim()) push(before, narration, "ปกติ", "narration", strictLabels);
      const after = line.slice(start + quote[0].length);
      const preceding = line.slice(0, start);
      const following = after.slice(0, 90);
      const pre = preceding.match(/([ก-๙A-Za-z][ก-๙A-Za-z0-9]*)\s*(?:กล่าว|พูด|ถาม|ตอบ|กระซิบ|ตะโกน|ร้อง|เอ่ย|บอก)\s*$/);
      const post = following.match(/^\s*([ก-๙A-Za-z][ก-๙A-Za-z0-9]*)\s*(?:กล่าว|พูด|ถาม|ตอบ|กระซิบ|ตะโกน|ร้อง|เอ่ย|บอก)/);
      const explicitSpeaker = pre?.[1] || post?.[1];
      const speaker = explicitSpeaker || previousSpeaker || "ไม่ทราบผู้พูด";
      push(quote[1] ?? quote[2] ?? "", speaker, "ปกติ", "dialogue", !explicitSpeaker);
      if (explicitSpeaker) previousSpeaker = explicitSpeaker;
      cursor = start + quote[0].length;
    }
    if (cursor < line.length) {
      const tail = line.slice(cursor);
      if (tail.trim()) push(tail, narration, "ปกติ", "narration", strictLabels);
    }
  }
  return result;
}
