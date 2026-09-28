import type { AssetJob, GeneratedAsset } from "../shared/content-factory";

export class AssetJobQueue {
  constructor(private jobs: AssetJob[] = []) {}

  enqueue(...incoming: AssetJob[]): void {
    this.jobs.push(...incoming);
  }

  next(): AssetJob | null {
    return this.jobs.find((job) => job.status === "queued") ?? null;
  }

  markRunning(jobId: string): AssetJob {
    return this.update(jobId, (job) => ({
      ...job,
      status: "running",
      attempts: job.attempts + 1,
      error: undefined,
      updatedAt: new Date().toISOString()
    }));
  }

  complete(jobId: string, asset: GeneratedAsset): AssetJob {
    return this.update(jobId, (job) => ({
      ...job,
      status: "succeeded",
      outputAssetId: asset.id,
      error: undefined,
      updatedAt: new Date().toISOString()
    }));
  }

  fail(jobId: string, error: string): AssetJob {
    return this.update(jobId, (job) => ({
      ...job,
      status: "failed",
      error,
      updatedAt: new Date().toISOString()
    }));
  }

  retry(jobId: string): AssetJob {
    return this.update(jobId, (job) => ({
      ...job,
      status: "queued",
      error: undefined,
      updatedAt: new Date().toISOString()
    }));
  }

  snapshot(): AssetJob[] {
    return this.jobs.map((job) => ({ ...job }));
  }

  private update(jobId: string, mutate: (job: AssetJob) => AssetJob): AssetJob {
    const index = this.jobs.findIndex((job) => job.id === jobId);
    if (index < 0) throw new Error(`Asset job not found: ${jobId}`);
    const updated = mutate(this.jobs[index]);
    this.jobs[index] = updated;
    return updated;
  }
}
