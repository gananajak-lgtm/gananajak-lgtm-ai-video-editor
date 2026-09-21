import type { ContentBatch, ContentBatchItem, ContentBrief, ContentProject } from "../shared/content-factory";


export function createContentBatch(briefs: ContentBrief[]): ContentBatch {
  const now = new Date().toISOString();
  return {
    id: `batch-${Date.now()}`,
    createdAt: now,
    updatedAt: now,
    items: briefs.map((brief, index) => ({
      id: `item-${index + 1}`,
      brief,
      status: "queued"
    }))
  };
}

export async function prepareContentBatch(
  batch: ContentBatch,
  createProject: (brief: ContentBrief) => Promise<ContentProject>,
  onProgress?: (completed: number, total: number, item: ContentBatchItem) => void
): Promise<ContentBatch> {
  const items = batch.items.map((item) => ({ ...item }));
  let completed = items.filter((item) => item.status === "ready" || item.status === "failed").length;
  onProgress?.(completed, items.length, items[Math.min(completed, Math.max(0, items.length - 1))]);

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (item.status === "ready") continue;
    item.status = "preparing";
    item.error = undefined;
    try {
      item.project = await createProject(item.brief);
      item.status = "ready";
    } catch (error) {
      item.status = "failed";
      item.error = error instanceof Error ? error.message : String(error);
    }
    completed += 1;
    onProgress?.(completed, items.length, item);
  }

  return { ...batch, items, updatedAt: new Date().toISOString() };
}
