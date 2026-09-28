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
  let completed = items.filter((item) => item.status !== "queued" && !(item.status === "failed" && item.failedStage === "project")).length;
  const initialItem = items.find((item) => item.status !== "ready") ?? items[items.length - 1];
  if (initialItem) onProgress?.(completed, items.length, initialItem);

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (item.status !== "queued" && !(item.status === "failed" && item.failedStage === "project")) continue;
    item.status = "preparing";
    item.error = undefined;
    item.failedStage = undefined;
    try {
      item.project = await createProject(item.brief);
      item.status = "ready";
    } catch (error) {
      item.status = "failed";
      item.error = error instanceof Error ? error.message : String(error);
      item.failedStage = "project";
    }
    completed += 1;
    onProgress?.(completed, items.length, item);
  }

  return { ...batch, items, updatedAt: new Date().toISOString() };
}
