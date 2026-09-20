import { randomUUID } from "node:crypto";
import type {
  ContentFactoryProject,
  CreateContentProjectInput
} from "../../shared/contentFactory";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function createContentFactoryProject(
  input: CreateContentProjectInput
): ContentFactoryProject {
  const topic = input.topic.trim();
  if (!topic) {
    throw new Error("Content topic is required.");
  }

  const now = new Date().toISOString();

  return {
    schemaVersion: 1,
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
    status: "draft",
    brief: {
      topic,
      title: input.title?.trim() || topic,
      language: input.language?.trim() || "th",
      targetDurationSeconds: clamp(
        Math.round(input.targetDurationSeconds ?? 60),
        10,
        7200
      ),
      aspectRatio: input.aspectRatio ?? "9:16",
      assetPreference: input.assetPreference ?? "mixed",
      tone: (input.tone ?? []).map((item) => item.trim()).filter(Boolean),
      audience: input.audience?.trim() || null,
      visualStyle: input.visualStyle?.trim() || null
    },
    script: null,
    scenePlan: null
  };
}
