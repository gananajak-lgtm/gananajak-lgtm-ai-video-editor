import type {
  ContentBrief,
  ContentProject,
  ContentScene
} from "../../shared/content-factory";
import { getOpenAiApiKey } from "../settings";
import { buildAssetPlan } from "../content-asset-planner";

const DEFAULT_MODEL = "gpt-4o-mini";

type GeneratedScene = {
  narration: string;
  visualIntent: string;
  imagePrompt: string;
  videoPrompt: string | null;
  sfxHints: string[];
  estimatedDuration: number;
};

type GeneratedContent = {
  title: string;
  script: string;
  scenes: GeneratedScene[];
};

type ResponsesApiResult = {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: {
    message?: string;
  };
};

const contentSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "script", "scenes"],
  properties: {
    title: { type: "string" },
    script: { type: "string" },
    scenes: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "narration",
          "visualIntent",
          "imagePrompt",
          "videoPrompt",
          "sfxHints",
          "estimatedDuration"
        ],
        properties: {
          narration: { type: "string" },
          visualIntent: { type: "string" },
          imagePrompt: { type: "string" },
          videoPrompt: { type: ["string", "null"] },
          sfxHints: {
            type: "array",
            items: { type: "string" }
          },
          estimatedDuration: {
            type: "number",
            minimum: 1
          }
        }
      }
    }
  }
} as const;

function extractOutputText(result: ResponsesApiResult): string | null {
  if (result.output_text?.trim()) return result.output_text.trim();

  for (const item of result.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && content.text?.trim()) {
        return content.text.trim();
      }
    }
  }

  return null;
}

function buildPrompt(brief: ContentBrief): string {
  const formatHint =
    brief.format === "short"
      ? "Fast, high-retention vertical short-form video."
      : "Story-driven long-form episode.";

  return [
    `Topic: ${brief.topic}`,
    `Language: ${brief.language}`,
    `Target duration: ${brief.targetDurationSeconds} seconds`,
    `Format: ${formatHint}`,
    `Tone: ${brief.tone ?? "cinematic documentary"}`,
    `Audience: ${brief.audience ?? "general audience"}`,
    "",
    "Write a complete narration script and divide it into production-ready scenes.",
    "Each scene must describe the intended visual, an image-generation prompt,",
    "an optional video-generation prompt, useful sound-effect hints, and an",
    "estimated scene duration. Keep the total scene duration close to the target.",
    "For legends, mysteries, or disputed stories, distinguish reported facts from",
    "legend or folklore instead of presenting uncertain claims as confirmed facts."
  ].join("\n");
}

function normalizeScene(
  projectId: string,
  scene: GeneratedScene,
  index: number
): ContentScene {
  return {
    id: `${projectId}-scene-${index + 1}`,
    order: index + 1,
    narration: scene.narration.trim(),
    visualIntent: scene.visualIntent.trim(),
    imagePrompt: scene.imagePrompt.trim(),
    videoPrompt: scene.videoPrompt?.trim() || undefined,
    sfxHints: scene.sfxHints.map((hint) => hint.trim()).filter(Boolean),
    estimatedDuration: Math.max(1, Number(scene.estimatedDuration.toFixed(2)))
  };
}

export async function generateContentProject(
  brief: ContentBrief
): Promise<ContentProject> {
  const apiKey = await getOpenAiApiKey();
  if (!apiKey) {
    throw new Error(
      "AI content generation is not configured. Add an OpenAI API key in AI settings."
    );
  }

  const model = process.env.OPENAI_CONTENT_MODEL?.trim() || DEFAULT_MODEL;
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      instructions:
        "You are the pre-production brain for an automatic video editor. Return production-ready structured content only.",
      input: buildPrompt(brief),
      text: {
        format: {
          type: "json_schema",
          name: "video_content_project",
          strict: true,
          schema: contentSchema
        }
      }
    })
  });

  const result = (await response.json()) as ResponsesApiResult;
  if (!response.ok) {
    throw new Error(
      result.error?.message ||
        `Content generation request failed with HTTP ${response.status}.`
    );
  }

  const outputText = extractOutputText(result);
  if (!outputText) {
    throw new Error("Content generation returned no structured output.");
  }

  let generated: GeneratedContent;
  try {
    generated = JSON.parse(outputText) as GeneratedContent;
  } catch {
    throw new Error("Content generation returned invalid JSON.");
  }

  if (!generated.title?.trim() || !generated.script?.trim() || !generated.scenes?.length) {
    throw new Error("Content generation returned an incomplete project.");
  }

  const now = new Date().toISOString();
  const projectId = `content-${Date.now()}`;

  const project: ContentProject = {
    schemaVersion: 1,
    id: projectId,
    title: generated.title.trim(),
    brief,
    script: generated.script.trim(),
    scenes: generated.scenes.map((scene, index) =>
      normalizeScene(projectId, scene, index)
    ),
    createdAt: now,
    updatedAt: now,
    generation: {
      provider: "openai",
      model
    }
  };

  return {
    ...project,
    assetPlan: buildAssetPlan(project)
  };
}
