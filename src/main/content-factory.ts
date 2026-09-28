import type { ContentBrief, ContentProject } from "../shared/content-factory";
import { buildAssetPlan, type AssetPlanningOptions } from "./content-asset-planner";
import { buildContentProject } from "./content-scene-planner";
import type { AiScenePlanner, ScriptGenerator } from "./content-ai-provider";

export class ContentFactory {
  constructor(
    private readonly scripts: ScriptGenerator,
    private readonly aiScenes?: AiScenePlanner
  ) {}

  async create(brief: ContentBrief): Promise<ContentProject> {
    const generated = await this.scripts.generate(brief);
    const id = `content-${Date.now()}`;

    if (this.aiScenes) {
      return this.aiScenes.plan({
        projectId: id,
        title: generated.title,
        brief,
        script: generated.script
      });
    }

    return buildContentProject(id, generated.title, brief, generated.script);
  }

  async createWithAssetPlan(
    brief: ContentBrief,
    options?: AssetPlanningOptions
  ): Promise<ContentProject> {
    const project = await this.create(brief);
    return {
      ...project,
      assetPlan: buildAssetPlan(project, options),
      updatedAt: new Date().toISOString()
    };
  }
}
