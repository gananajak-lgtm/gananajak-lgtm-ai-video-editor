import type { ContentBrief } from "../shared/content-factory";

export type ScriptGenerationResult = {
  title: string;
  script: string;
};

export interface ScriptGenerator {
  generate(brief: ContentBrief): Promise<ScriptGenerationResult>;
}

export type ScenePlanningInput = {
  projectId: string;
  title: string;
  brief: ContentBrief;
  script: string;
};

export interface AiScenePlanner {
  plan(input: ScenePlanningInput): Promise<import("../shared/content-factory").ContentProject>;
}
