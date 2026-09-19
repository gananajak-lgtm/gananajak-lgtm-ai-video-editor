import type {
  SceneBlock,
  VisualBrainPlan
} from "../../shared/types";
import { analyzeImages } from "./imageAnalyzer";
import { matchScenesToImages } from "./sceneMatcher";
import { planShots } from "./shotPlanner";

export async function buildVisualBrainPlan(
  scenes: SceneBlock[],
  imagePaths: string[]
): Promise<VisualBrainPlan> {
  if (!scenes.length) {
    throw new Error("No grouped story scenes are available for Visual Brain.");
  }

  if (!imagePaths.length) {
    throw new Error("No story images are available for Visual Brain.");
  }

  const descriptors = await analyzeImages(imagePaths);
  const matches = matchScenesToImages(scenes, descriptors);
  const shots = planShots(scenes, matches, descriptors);

  if (!shots.length) {
    throw new Error("Visual Brain could not create any planned shots.");
  }

  return {
    descriptors,
    matches,
    shots
  };
}
