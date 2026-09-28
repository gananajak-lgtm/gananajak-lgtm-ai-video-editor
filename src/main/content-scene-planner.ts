import type { ContentBrief, ContentProject, ContentScene } from "../shared/content-factory";

const WORDS_PER_SECOND = 2.25;

function splitScript(script: string): string[] {
  return script
    .split(/(?<=[.!?。！？])\\s+|\\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function estimateDuration(text: string): number {
  const words = text.split(/\\s+/).filter(Boolean).length;
  return Math.max(2.5, Number((words / WORDS_PER_SECOND).toFixed(2)));
}

export function buildContentProject(
  id: string,
  title: string,
  brief: ContentBrief,
  script: string
): ContentProject {
  const chunks = splitScript(script);
  const scenes: ContentScene[] = chunks.map((narration, index) => ({
    id: `${id}-scene-${index + 1}`,
    order: index + 1,
    narration,
    visualIntent: narration,
    imagePrompt: `Cinematic vertical documentary shot illustrating: ${narration}`,
    videoPrompt: `10-second vertical cinematic documentary video illustrating: ${narration}. Natural motion, realistic lighting, no narration, no dialogue, no subtitles.`,
    sfxHints: [],
    estimatedDuration: estimateDuration(narration)
  }));

  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    id,
    title,
    brief,
    script,
    scenes,
    createdAt: now,
    updatedAt: now
  };
}


export function buildLocalTestProject(brief: ContentBrief): ContentProject {
  const topic = brief.topic.trim() || "Untitled topic";
  const target = Math.max(10, brief.targetDurationSeconds);
  const sceneCount = Math.max(3, Math.min(12, Math.round(target / 10)));
  const language = brief.language === "th" ? "th" : "en";
  const lines = Array.from({ length: sceneCount }, (_, index) => language === "th"
    ? `ฉากที่ ${index + 1}: สำรวจประเด็นสำคัญของ ${topic} จากมุมมองที่แตกต่างกัน`
    : `Scene ${index + 1}: Explore an important aspect of ${topic} from a different perspective.`);
  const script = lines.join("\n");
  return buildContentProject(`local-${Date.now()}`, `[LOCAL TEST] ${topic}`, brief, script);
}
