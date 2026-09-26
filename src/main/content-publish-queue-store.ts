import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PublishJob } from "../shared/content-factory";

type PublishQueueState = {
  jobs: PublishJob[];
  updatedAt: string;
};

const emptyQueue = (): PublishQueueState => ({ jobs: [], updatedAt: new Date(0).toISOString() });

export async function loadPublishQueue(rootDir: string): Promise<PublishQueueState> {
  try {
    const raw = await readFile(path.join(rootDir, "publish-queue.json"), "utf8");
    const parsed = JSON.parse(raw) as Partial<PublishQueueState>;
    return { jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [], updatedAt: parsed.updatedAt ?? new Date(0).toISOString() };
  } catch {
    return emptyQueue();
  }
}

export async function savePublishQueue(rootDir: string, jobs: PublishJob[]): Promise<PublishQueueState> {
  await mkdir(rootDir, { recursive: true });
  const state: PublishQueueState = { jobs, updatedAt: new Date().toISOString() };
  await writeFile(path.join(rootDir, "publish-queue.json"), JSON.stringify(state, null, 2), "utf8");
  return state;
}
