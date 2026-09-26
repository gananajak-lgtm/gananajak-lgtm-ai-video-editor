import path from "node:path";
import type { ContentBatch, ContentBatchItem, ContentProject } from "../shared/content-factory";
import { buildAssetPlan } from "./content-asset-planner";
import { runAssetPlan } from "./content-asset-runner";
import type { AssetProviderRegistry } from "./content-asset-provider";

export type BatchAssetProgress = {
  completed: number;
  total: number;
  item: ContentBatchItem;
  assetCompleted?: number;
  assetTotal?: number;
  kind?: string;
};

export async function generateBatchAssets(
  batch: ContentBatch,
  registry: AssetProviderRegistry,
  rootDir: string,
  onProgress?: (progress: BatchAssetProgress) => void
): Promise<ContentBatch> {
  const items = batch.items.map((item) => ({ ...item }));
  const runnable = items.filter((item) => item.project && (item.status === "ready" || (item.status === "failed" && item.failedStage === "assets")));
  let completed = items.filter((item) => item.status === "assets-ready").length;
  const total = completed + runnable.length;

  for (const item of items) {
    if (!item.project || item.status === "assets-ready" || (item.status !== "ready" && !(item.status === "failed" && item.failedStage === "assets"))) continue;
    item.status = "generating-assets";
    item.error = undefined;
    item.failedStage = undefined;
    onProgress?.({ completed, total, item: { ...item } });
    try {
      const project: ContentProject = item.project;
      const planned = project.assetPlan ?? buildAssetPlan(project, { includeVideo:true, includeSfx:false });
      const assetPlan = await runAssetPlan(planned, registry, path.join(rootDir, project.id), (progress) => {
        onProgress?.({ completed, total, item: { ...item }, assetCompleted:progress.completed, assetTotal:progress.total, kind:progress.kind });
      });
      const failed = assetPlan.jobs.filter((job) => (job.kind === "image" || job.kind === "voice") && job.status === "failed");
      item.project = { ...project, assetPlan, updatedAt:new Date().toISOString() };
      if (failed.length) {
        item.status = "failed";
        item.error = failed.map((job) => job.error ?? `${job.kind} failed`).join("; ");
        item.failedStage = "assets";
      } else {
        item.status = "assets-ready";
      }
    } catch (error) {
      item.status = "failed";
      item.error = error instanceof Error ? error.message : String(error);
      item.failedStage = "assets";
    }
    completed += 1;
    onProgress?.({ completed, total, item: { ...item } });
  }
  return { ...batch, items, updatedAt:new Date().toISOString() };
}
