import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { AssetJob, GeneratedAsset } from "../../shared/content-factory";

export type MetaManualVideoTask = {
  jobId: string;
  sceneId: string;
  prompt: string;
  status: "waiting-for-meta" | "ready";
};

export function buildMetaManualVideoTasks(jobs: AssetJob[]): MetaManualVideoTask[] {
  return jobs.filter((job) => job.kind === "video").map((job) => ({
    jobId: job.id,
    sceneId: job.sceneId,
    prompt: job.prompt,
    status: job.outputAssetId ? "ready" : "waiting-for-meta"
  }));
}

export async function importMetaVideo(job: AssetJob, inputPath: string, workDir: string): Promise<GeneratedAsset> {
  if (job.kind !== "video") throw new Error("Meta manual import requires a video job.");
  await mkdir(workDir, { recursive: true });
  const extension = path.extname(inputPath) || ".mp4";
  const filePath = path.join(workDir, `${job.id}-meta${extension}`);
  await copyFile(inputPath, filePath);
  return {
    id: `asset-${job.id}-meta`,
    projectId: job.projectId,
    sceneId: job.sceneId,
    kind: "video",
    filePath,
    provider: "meta-ai-manual",
    source: "meta-manual",
    sourcePrompt: job.prompt
  };
}
