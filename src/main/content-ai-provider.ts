import type { ContentBrief, ContentProject, ContentScene } from "../shared/content-factory";

export type ScriptGenerationResult = { title: string; script: string };

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
  plan(input: ScenePlanningInput): Promise<ContentProject>;
}

export type StructuredSceneDraft = Omit<ContentScene, "id" | "order">;

export interface StructuredContentModel {
  generateScript(brief: ContentBrief): Promise<ScriptGenerationResult>;
  generateScenes(input: ScenePlanningInput): Promise<StructuredSceneDraft[]>;
}

export class ModelBackedScriptGenerator implements ScriptGenerator {
  constructor(private readonly model: StructuredContentModel) {}
  generate(brief: ContentBrief): Promise<ScriptGenerationResult> {
    return this.model.generateScript(brief);
  }
}

export class ModelBackedScenePlanner implements AiScenePlanner {
  constructor(private readonly model: StructuredContentModel) {}

  async plan(input: ScenePlanningInput): Promise<ContentProject> {
    const drafts = await this.model.generateScenes(input);
    const now = new Date().toISOString();
    return {
      schemaVersion: 1,
      id: input.projectId,
      title: input.title,
      brief: input.brief,
      script: input.script,
      scenes: drafts.map((scene, index) => ({
        ...scene,
        id: `${input.projectId}-scene-${index + 1}`,
        order: index + 1
      })),
      createdAt: now,
      updatedAt: now
    };
  }
}
