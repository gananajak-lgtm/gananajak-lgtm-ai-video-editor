import type { ContentBatchItem, PublishPlan } from "../shared/content-factory";

function cleanTag(value: string) {
  return value.replace(/[^\\p{L}\\p{N}_]+/gu, "").trim();
}

export function buildPublishPlan(item: ContentBatchItem): PublishPlan {
  const topic = item.brief.topic.trim();
  const projectTitle = item.project?.title?.replace(/^\\[LOCAL TEST\\]\\s*/i, "").trim();
  const title = projectTitle || topic || "Untitled video";
  const topicWords = topic.split(/\\s+/).map(cleanTag).filter(Boolean).slice(0, 4);
  const formatTag = item.brief.format === "short" ? "Shorts" : "Video";
  const languageTag = item.brief.language === "th" ? "ไทย" : "English";
  const hashtags = Array.from(new Set([...topicWords, formatTag, languageTag])).slice(0, 8);
  const description = item.brief.language === "th"
    ? `${title}\\n\\nวิดีโอนี้สร้างและตัดต่อผ่าน Gananajak AI Content Factory`
    : `${title}\\n\\nCreated and edited with Gananajak AI Content Factory.`;
  return { status: item.outputPath ? "ready" : "draft", title, description, caption: title, hashtags, platforms: [] };
}

export function ensurePublishPlan(item: ContentBatchItem): ContentBatchItem {
  return item.publish ? item : { ...item, publish: buildPublishPlan(item) };
}
