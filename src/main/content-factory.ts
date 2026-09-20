import type { ContentBrief, ContentProject } from "../shared/content-factory";
import { buildContentProject } from "./content-scene-planner";
import type { ScriptGenerator } from "./content-ai-provider";
export class ContentFactory {
  constructor(private readonly scripts: ScriptGenerator) {}
  async create(brief: ContentBrief): Promise<ContentProject> {
    const generated = await this.scripts.generate(brief);
    return buildContentProject(`content-${Date.now()}`, generated.title, brief, generated.script);
  }
}
