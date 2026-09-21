import type { AssetPlan, GeneratedAsset } from "../shared/content-factory";
import { AssetJobQueue } from "./content-asset-queue";
import type { AssetProviderRegistry } from "./content-asset-provider";

export type AssetRunProgress = { completed: number; total: number; currentJobId?: string; kind?: string };

export async function runAssetPlan(
  plan: AssetPlan,
  registry: AssetProviderRegistry,
  workDir: string,
  onProgress?: (progress: AssetRunProgress) => void
): Promise<AssetPlan> {
  const runnableKinds = new Set(["image", "voice"]);
  const queue = new AssetJobQueue(plan.jobs.filter((job) => runnableKinds.has(job.kind)).map((job) => ({ ...job, status: job.status === "failed" ? "queued" : job.status, error: job.status === "failed" ? undefined : job.error })));
  const assets: GeneratedAsset[] = [...plan.assets];
  const assetIndexByJobId = new Map(plan.jobs.flatMap((job) => job.outputAssetId ? [[job.id, job.outputAssetId] as const] : []));
  const runnableJobs = plan.jobs.filter((job) => runnableKinds.has(job.kind));
  const retryableJobs = runnableJobs.filter((job) => job.status === "queued" || job.status === "failed");
  const alreadySucceeded = runnableJobs.filter((job) => job.status === "succeeded").length;
  const total = alreadySucceeded + retryableJobs.length;
  let completed = alreadySucceeded;
  onProgress?.({ completed, total });

  while (true) {
    const job = queue.next();
    if (!job) break;
    queue.markRunning(job.id);
    onProgress?.({ completed, total, currentJobId: job.id, kind: job.kind });
    try {
      const provider = registry.resolve(job.kind);
      const asset = await provider.generate(job, { projectId: job.projectId, sceneId: job.sceneId, workDir });
      const previousAssetId = assetIndexByJobId.get(job.id);
      if (previousAssetId) {
        const previousIndex = assets.findIndex((item) => item.id === previousAssetId);
        if (previousIndex >= 0) assets.splice(previousIndex, 1);
      }
      const duplicateIndex = assets.findIndex((item) => item.id === asset.id);
      if (duplicateIndex >= 0) assets.splice(duplicateIndex, 1);
      assets.push(asset);
      assetIndexByJobId.set(job.id, asset.id);
      queue.complete(job.id, asset);
    } catch (error) {
      queue.fail(job.id, error instanceof Error ? error.message : String(error));
    }
    completed += 1;
    onProgress?.({ completed, total, currentJobId: job.id, kind: job.kind });
  }

  const runnableById = new Map(queue.snapshot().map((job) => [job.id, job]));
  const jobs = plan.jobs.map((job) => runnableById.get(job.id) ?? job);
  return { ...plan, jobs, assets };
}
