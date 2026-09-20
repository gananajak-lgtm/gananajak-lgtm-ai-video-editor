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
