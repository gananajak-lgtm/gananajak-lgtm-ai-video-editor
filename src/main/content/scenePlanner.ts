import type {
  ContentAssetPreference,
  ContentAssetType,
  ContentScene,
  ContentScenePlan,
  ScenePlannerInput
} from "../../shared/contentFactory";

type TextUnit = {
  text: string;
  duration: number;
};

const SFX_RULES: Array<{ label: string; keywords: string[] }> = [
  { label: "rain", keywords: ["rain", "storm", "ฝน", "พายุ"] },
  { label: "thunder", keywords: ["thunder", "ฟ้าร้อง", "ฟ้าผ่า"] },
  { label: "water", keywords: ["water", "river", "canal", "น้ำ", "แม่น้ำ", "คลอง"] },
  { label: "wind", keywords: ["wind", "ลม", "ลมพัด"] },
  { label: "door", keywords: ["door", "ประตู"] },
  { label: "footsteps", keywords: ["footstep", "walk", "เดิน", "ฝีเท้า"] },
  { label: "fire", keywords: ["fire", "flame", "ไฟ", "เปลวไฟ"] },
  { label: "forest", keywords: ["forest", "jungle", "ป่า"] },
  { label: "birds", keywords: ["bird", "birds", "นก"] }
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeText(text: string) {
  return text.replace(/\s+/gu, " ").trim();
}

function getWordSegments(text: string, locale: string) {
  try {
    const segmenter = new Intl.Segmenter(locale, { granularity: "word" });
    return Array.from(segmenter.segment(text));
  } catch {
    return [];
  }
}

function countWords(text: string, locale: string) {
  const segments = getWordSegments(text, locale);
  const segmentedWordCount = segments.filter((segment) => segment.isWordLike).length;
  if (segmentedWordCount > 0) return segmentedWordCount;

  const normalized = normalizeText(text);
  if (!normalized) return 0;
  const whitespaceWords = normalized.split(/\s+/u).filter(Boolean).length;
  if (whitespaceWords > 1) return whitespaceWords;
  return Math.max(1, Math.ceil(normalized.length / 5));
}

function estimateSeconds(text: string, locale: string, wordsPerMinute: number) {
  return Math.max(1, countWords(text, locale) / (wordsPerMinute / 60));
}

function splitSentences(text: string, locale: string) {
  const normalized = text.trim();
  if (!normalized) return [];

  try {
    const segmenter = new Intl.Segmenter(locale, { granularity: "sentence" });
    const sentences = Array.from(segmenter.segment(normalized))
      .map((segment) => normalizeText(segment.segment))
      .filter(Boolean);
    if (sentences.length > 1) return sentences;
  } catch {
    // Fall through to punctuation/newline segmentation.
  }

  return normalized
    .split(/(?<=[.!?。！？])\s+|\n+/u)
    .map(normalizeText)
    .filter(Boolean);
}

function splitLongUnit(
  text: string,
  locale: string,
  wordsPerMinute: number,
  maxSceneSeconds: number
) {
  if (estimateSeconds(text, locale, wordsPerMinute) <= maxSceneSeconds) {
    return [text];
  }

  const segments = getWordSegments(text, locale);
  if (segments.length === 0) return [text];

  const maxWords = Math.max(
    1,
    Math.floor((maxSceneSeconds * wordsPerMinute) / 60)
  );

  const chunks: string[] = [];
  let buffer = "";
  let wordCount = 0;

  for (const segment of segments) {
    buffer += segment.segment;
    if (segment.isWordLike) wordCount += 1;

    if (wordCount >= maxWords) {
      const chunk = normalizeText(buffer);
      if (chunk) chunks.push(chunk);
      buffer = "";
      wordCount = 0;
    }
  }

  const tail = normalizeText(buffer);
  if (tail) chunks.push(tail);
  return chunks.length > 0 ? chunks : [text];
}

function chooseAssetType(
  preference: ContentAssetPreference,
  sceneIndex: number
): ContentAssetType {
  if (preference === "image") return "image";
  if (preference === "video") return "video";
  return sceneIndex === 0 || sceneIndex % 3 === 0 ? "video" : "image";
}

function detectSfxHints(text: string) {
  const lower = text.toLocaleLowerCase();
  return SFX_RULES
    .filter((rule) => rule.keywords.some((keyword) => lower.includes(keyword)))
    .map((rule) => rule.label);
}

function makeVisualIntent(text: string) {
  const normalized = normalizeText(text);
  if (normalized.length <= 180) return normalized;
  return `${normalized.slice(0, 177).trimEnd()}...`;
}

function makePromptSeed(
  visualIntent: string,
  assetType: ContentAssetType,
  aspectRatio: ScenePlannerInput["aspectRatio"],
  visualStyle: string | null | undefined
) {
  const style = visualStyle?.trim()
    ? `, visual style: ${visualStyle.trim()}`
    : "";
  return `Cinematic ${assetType} for: ${visualIntent}${style}, ${aspectRatio} composition, coherent story continuity, no text overlays.`;
}

function mergeShortTail(scenes: TextUnit[], minSceneSeconds: number) {
  if (scenes.length < 2) return scenes;
  const last = scenes[scenes.length - 1];
  if (last.duration >= minSceneSeconds) return scenes;

  const previous = scenes[scenes.length - 2];
  return [
    ...scenes.slice(0, -2),
    {
      text: normalizeText(`${previous.text} ${last.text}`),
      duration: previous.duration + last.duration
    }
  ];
}

export function planContentScenes(input: ScenePlannerInput): ContentScenePlan {
  const narration = input.script.narration.trim();
  if (!narration) {
    throw new Error("Narration is required before scene planning.");
  }

  const locale = input.script.language?.trim() || "th";
  const wordsPerMinute = clamp(Math.round(input.wordsPerMinute ?? 155), 80, 240);
  const preferredSceneSeconds = clamp(input.preferredSceneSeconds ?? 6, 3, 20);
  const minSceneSeconds = clamp(
    input.minSceneSeconds ?? 3,
    1,
    preferredSceneSeconds
  );
  const maxSceneSeconds = clamp(
    input.maxSceneSeconds ?? 10,
    preferredSceneSeconds,
    30
  );

  const units = splitSentences(narration, locale)
    .flatMap((sentence) =>
      splitLongUnit(sentence, locale, wordsPerMinute, maxSceneSeconds)
    )
    .map((text) => ({
      text,
      duration: estimateSeconds(text, locale, wordsPerMinute)
    }));

  const grouped: TextUnit[] = [];
  let currentText = "";
  let currentDuration = 0;

  const flush = () => {
    const text = normalizeText(currentText);
    if (!text) return;
    grouped.push({ text, duration: currentDuration });
    currentText = "";
    currentDuration = 0;
  };

  for (const unit of units) {
    if (
      currentDuration > 0 &&
      currentDuration + unit.duration > maxSceneSeconds
    ) {
      flush();
    }

    currentText = normalizeText(
      currentText ? `${currentText} ${unit.text}` : unit.text
    );
    currentDuration += unit.duration;

    if (currentDuration >= preferredSceneSeconds) flush();
  }
  flush();

  const scenes: ContentScene[] = mergeShortTail(
    grouped,
    minSceneSeconds
  ).map((scene, index) => {
    const assetType = chooseAssetType(input.assetPreference, index);
    const visualIntent = makeVisualIntent(scene.text);

    return {
      id: `content-scene-${String(index + 1).padStart(3, "0")}`,
      order: index,
      narration: scene.text,
      estimatedDurationSeconds: round(scene.duration),
      visualIntent,
      assetType,
      promptSeed: makePromptSeed(
        visualIntent,
        assetType,
        input.aspectRatio,
        input.visualStyle
      ),
      continuityNotes: [],
      sfxHints: detectSfxHints(scene.text)
    };
  });

  return {
    targetDurationSeconds: Math.max(1, Math.round(input.targetDurationSeconds)),
    estimatedDurationSeconds: round(
      scenes.reduce((sum, scene) => sum + scene.estimatedDurationSeconds, 0)
    ),
    wordsPerMinute,
    scenes
  };
}
