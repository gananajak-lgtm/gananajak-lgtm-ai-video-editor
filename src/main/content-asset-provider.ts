import type { AssetJob, AssetKind, GeneratedAsset } from "../shared/content-factory";

export type AssetGenerationContext = { projectId: string; sceneId: string; workDir: string };

export interface AssetProvider {
  readonly id: string;
  supports(kind: AssetKind): boolean;
  generate(job: AssetJob, context: AssetGenerationContext): Promise<GeneratedAsset>;
}

export class AssetProviderRegistry {
  constructor(private readonly providers: AssetProvider[]) {}

  resolve(kind: AssetKind): AssetProvider {
    const provider = this.providers.find((candidate) => candidate.supports(kind));
    if (!provider) throw new Error(`No asset provider configured for ${kind} generation.`);
    return provider;
  }
}
