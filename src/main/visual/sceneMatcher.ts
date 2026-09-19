import type {
  ImageDescriptor,
  SceneBlock,
  SceneImageMatch
} from "../../shared/types";

function normalize(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function phraseMatches(text: string, phrase: string) {
  const normalizedPhrase = normalize(phrase);
  return normalizedPhrase.length >= 2 && normalize(text).includes(normalizedPhrase);
}

function scoreField(
  sceneText: string,
  values: string[],
  weight: number,
  label: string
) {
  const hits = values.filter((value) => phraseMatches(sceneText, value));
  return {
    score: Math.min(weight * 3, hits.length * weight),
    reason: hits.length ? `${label}: ${hits.slice(0, 3).join(", ")}` : null
  };
}

function scoreSceneAgainstImage(
  scene: SceneBlock,
  image: ImageDescriptor
): { score: number; reason: string } {
  let score = 0;
  const reasons: string[] = [];

  const summaryWords = normalize(image.summary)
    .split(" ")
    .filter((value) => value.length >= 3);

  const fields = [
    scoreField(scene.text, image.characters, 4, "characters"),
    scoreField(scene.text, image.actions, 3, "actions"),
    scoreField(scene.text, image.setting, 2, "setting"),
    scoreField(scene.text, image.mood, 1, "mood"),
    scoreField(scene.text, summaryWords, 0.5, "summary")
  ];

  for (const field of fields) {
    score += field.score;
    if (field.reason) reasons.push(field.reason);
  }

  if (image.shotType === "wide" && scene.duration >= 7) {
    score += 0.4;
    reasons.push("wide framing supports a longer scene");
  }

  if (image.shotType === "close" && scene.duration <= 6) {
    score += 0.3;
    reasons.push("close framing supports a short emotional beat");
  }

  if (score === 0) {
    score = 0.05;
    reasons.push("fallback visual candidate");
  }

  return {
    score,
    reason: reasons.join(" | ")
  };
}

export function matchScenesToImages(
  scenes: SceneBlock[],
  images: ImageDescriptor[]
): SceneImageMatch[] {
  const matches: SceneImageMatch[] = [];

  for (const scene of scenes) {
    for (const image of images) {
      const scored = scoreSceneAgainstImage(scene, image);
      matches.push({
        sceneId: scene.id,
        imageId: image.id,
        score: scored.score,
        reason: scored.reason
      });
    }
  }

  return matches.sort((a, b) => {
    if (a.sceneId === b.sceneId) return b.score - a.score;
    return a.sceneId.localeCompare(b.sceneId);
  });
}

export function topMatchesForScene(
  matches: SceneImageMatch[],
  sceneId: string,
  limit = 5
) {
  return matches
    .filter((match) => match.sceneId === sceneId)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
