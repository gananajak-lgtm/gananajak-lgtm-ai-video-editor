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
  const queue = new AssetJobQueue(plan.jobs.map((job) => ({ ...job })));
  const assets: GeneratedAsset[] = [...plan.assets];
  const runnableKinds = new Set(["image", "voice"]);
  const runnableJobs = plan.jobs.filter((job) => runnableKinds.has(job.kind));
  const total = runnableJobs.length;
  let completed = plan.jobs.filter((job) => job.status === "succeeded").length;

  while (true) {
    const job = queue.next();
    if (!job) break;
    if (!runnableKinds.has(job.kind)) {
      // Manual/optional jobs stay queued so they can be completed later (for example Meta video import).
      const remainingRunnable = queue.snapshot().some((candidate) => candidate.status === "queued" && runnableKinds.has(candidate.kind));
      if (!remainingRunnable) break;
      queue.fail(job.id, `Optional ${job.kind} job deferred; no automatic provider configured.`);
      continue;
    }
    queue.markRunning(job.id);
    onProgress?.({ completed, total, currentJobId: job.id, kind: job.kind });
    try {
      const provider = registry.resolve(job.kind);
      const asset = await provider.generate(job, { projectId: job.projectId, sceneId: job.sceneId, workDir });
      assets.push(asset);
      queue.complete(job.id, asset);
    } catch (error) {
      queue.fail(job.id, error instanceof Error ? error.message : String(error));
    }
    completed += 1;
    onProgress?.({ completed, total, currentJobId: job.id, kind: job.kind });
  }

  return { ...plan, jobs: queue.snapshot(), assets };
}
