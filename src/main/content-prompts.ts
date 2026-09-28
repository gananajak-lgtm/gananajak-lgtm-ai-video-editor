import type { ContentBrief } from "../shared/content-factory";
export function buildScriptPrompt(brief: ContentBrief): string {
  return ["Write narration for a vertical documentary video.", `Topic: ${brief.topic}`, `Language: ${brief.language}`, `Format: ${brief.format}`, `Target duration: ${brief.targetDurationSeconds} seconds`, brief.tone ? `Tone: ${brief.tone}` : "", brief.audience ? `Audience: ${brief.audience}` : "", "Return a strong hook, concise factual narration, and a memorable ending.", "Do not include shot directions, markdown, subtitles, or production notes."].filter(Boolean).join("\n");
}
