import { app } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import type { ImageDescriptor, ShotType } from "../../shared/types";
import { getOpenAiApiKey } from "../settings";

type VisionJson = {
  summary: string;
  characters: string[];
  actions: string[];
  setting: string[];
  mood: string[];
  shotType: ShotType;
};

type CachedDescriptor = {
  signature: string;
  descriptor: ImageDescriptor;
};

type DescriptorCache = Record<string, CachedDescriptor>;

type ResponsesApiResult = {
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

const CACHE_FILE = "visual-image-cache.json";
const CONCURRENCY = 2;

function cachePath() {
  return path.join(app.getPath("userData"), CACHE_FILE);
}

async function readCache(): Promise<DescriptorCache> {
  try {
    return JSON.parse(await fs.readFile(cachePath(), "utf8")) as DescriptorCache;
  } catch {
    return {};
  }
}

async function writeCache(cache: DescriptorCache) {
  await fs.mkdir(path.dirname(cachePath()), { recursive: true });
  await fs.writeFile(cachePath(), JSON.stringify(cache, null, 2), "utf8");
}

async function fileSignature(filePath: string) {
  const stat = await fs.stat(filePath);
  return `${stat.size}:${Math.round(stat.mtimeMs)}`;
}

function imageIdFromPath(filePath: string, index: number) {
  const base = path.basename(filePath, path.extname(filePath));
  const safe = base.replace(/[^\p{L}\p{N}_-]+/gu, "-").slice(0, 80);
  return `image-${index + 1}-${safe || "asset"}`;
}

function mimeTypeFromPath(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

function extractOutputText(result: ResponsesApiResult) {
  for (const item of result.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && content.text) {
        return content.text;
      }
    }
  }
  return null;
}

async function analyzeSingleImage(
  filePath: string,
  index: number,
  apiKey: string
): Promise<ImageDescriptor> {
  const bytes = await fs.readFile(filePath);
  const mime = mimeTypeFromPath(filePath);
  const filename = path.basename(filePath);

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-5.6-luna",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                "Analyze this still image for an automatic story-video editor.",
                `Filename: ${filename}`,
                "Describe only what is visually supported. Do not guess real-world identity.",
                "Use short Thai labels when practical because narration is commonly Thai.",
                "If the filename clearly contains a fictional character label, it may be used as a character tag.",
                "Focus on characters/roles, visible action, location, mood, and camera framing."
              ].join("\n")
            },
            {
              type: "input_image",
              detail: "auto",
              image_url: `data:${mime};base64,${bytes.toString("base64")}`
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "story_image_descriptor",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              summary: { type: "string" },
              characters: {
                type: "array",
                items: { type: "string" }
              },
              actions: {
                type: "array",
                items: { type: "string" }
              },
              setting: {
                type: "array",
                items: { type: "string" }
              },
              mood: {
                type: "array",
                items: { type: "string" }
              },
              shotType: {
                type: "string",
                enum: ["close", "medium", "wide", "unknown"]
              }
            },
            required: [
              "summary",
              "characters",
              "actions",
              "setting",
              "mood",
              "shotType"
            ]
          }
        }
      }
    })
  });

  const result = (await response.json()) as ResponsesApiResult;

  if (!response.ok) {
    throw new Error(
      result.error?.message ||
        `Image analysis failed with HTTP ${response.status}.`
    );
  }

  const outputText = extractOutputText(result);
  if (!outputText) {
    throw new Error(`Visual Brain returned no descriptor for ${filename}.`);
  }

  const parsed = JSON.parse(outputText) as VisionJson;

  return {
    id: imageIdFromPath(filePath, index),
    filePath,
    summary: parsed.summary.trim(),
    characters: parsed.characters.map((value) => value.trim()).filter(Boolean),
    actions: parsed.actions.map((value) => value.trim()).filter(Boolean),
    setting: parsed.setting.map((value) => value.trim()).filter(Boolean),
    mood: parsed.mood.map((value) => value.trim()).filter(Boolean),
    shotType: parsed.shotType
  };
}

async function mapWithConcurrency<T, R>(
  values: T[],
  worker: (value: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let cursor = 0;

  async function runWorker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= values.length) return;
      results[index] = await worker(values[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, values.length) }, runWorker)
  );

  return results;
}

export async function analyzeImages(
  imagePaths: string[]
): Promise<ImageDescriptor[]> {
  const apiKey = await getOpenAiApiKey();
  if (!apiKey) {
    throw new Error(
      "Visual Brain is not configured. Add an OpenAI API key in AI Audio Brain settings first."
    );
  }

  const cache = await readCache();
  let cacheChanged = false;

  const descriptors = await mapWithConcurrency(
    imagePaths,
    async (filePath, index) => {
      const signature = await fileSignature(filePath);
      const cached = cache[filePath];

      if (cached?.signature === signature) {
        return {
          ...cached.descriptor,
          id: imageIdFromPath(filePath, index),
          filePath
        };
      }

      const descriptor = await analyzeSingleImage(filePath, index, apiKey);
      cache[filePath] = { signature, descriptor };
      cacheChanged = true;
      return descriptor;
    }
  );

  if (cacheChanged) {
    await writeCache(cache);
  }

  return descriptors;
}
