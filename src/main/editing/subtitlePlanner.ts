import type {
  SubtitleCue,
  TranscriptResult
} from "../../shared/types";

const MIN_SUBTITLE_SECONDS = 0.45;

function wrapSubtitle(text: string, maxChars = 42) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) return normalized;

  const words = normalized.split(" ");
  if (words.length === 1) {
    const lines: string[] = [];
    for (let index = 0; index < normalized.length; index += maxChars) {
      lines.push(normalized.slice(index, index + maxChars));
    }
    return lines.slice(0, 2).join("\n");
  }

  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
      if (lines.length === 1) continue;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);

  if (lines.length <= 2) return lines.join("\n");
  return [lines[0], lines.slice(1).join(" ")].join("\n");
}

export function buildSubtitleCues(
  transcript: TranscriptResult
): SubtitleCue[] {
  const segments = transcript.segments
    .filter((segment) => segment.text.trim() && segment.end > segment.start)
    .sort((a, b) => a.start - b.start);

  return segments.map((segment, index) => {
    const next = segments[index + 1];
    const naturalEnd = Math.min(
      segment.end,
      next ? Math.max(segment.start + MIN_SUBTITLE_SECONDS, next.start) : transcript.duration
    );

    return {
      id: `subtitle-${index + 1}`,
      start: Math.max(0, segment.start),
      end: Math.max(
        segment.start + MIN_SUBTITLE_SECONDS,
        Math.min(naturalEnd, transcript.duration)
      ),
      text: wrapSubtitle(segment.text)
    };
  });
}
