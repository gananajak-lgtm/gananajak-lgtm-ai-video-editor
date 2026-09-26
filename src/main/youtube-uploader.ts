import { stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import type { ContentBatchItem, PublishResult } from "../shared/content-factory";

export type YouTubeUploadInput = {
  accessToken: string;
  item: ContentBatchItem;
  privacyStatus?: "private" | "unlisted" | "public";
};

export async function uploadVideoToYouTube(input: YouTubeUploadInput): Promise<PublishResult> {
  if (!input.item.outputPath) throw new Error("Rendered video path is missing.");
  let fileInfo;
  try { fileInfo = await stat(input.item.outputPath); }
  catch { throw new Error("Rendered video file cannot be found. Render the video again or restore the file before retrying."); }
  if (!fileInfo.isFile()) throw new Error("Rendered video file cannot be found. Render the video again or restore the file before retrying.");
  if (fileInfo.size <= 0) throw new Error("Rendered video file is empty. Render the video again before publishing.");
  const plan = input.item.publish;
  if (!plan?.title?.trim()) throw new Error("YouTube title is required.");
  const title=plan.title.trim();
  if (title.length > 100) throw new Error("YouTube title must be 100 characters or fewer.");
  const description=[plan.description?.trim(), ...(plan.hashtags ?? []).map((tag) => `#${tag.replace(/^#/, "")}`)].filter(Boolean).join("\\n\\n");
  if (description.length > 5000) throw new Error("YouTube description must be 5000 characters or fewer.");

  const metadata = {
    snippet: {
      title,
      description,
      tags: (plan.hashtags ?? []).map((tag) => tag.replace(/^#/, "")).filter(Boolean),
      categoryId: "22"
    },
    status: { privacyStatus: input.privacyStatus ?? "private" }
  };

  const session = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: {
      authorization: `Bearer ${input.accessToken}`,
      "content-type": "application/json; charset=UTF-8",
      "x-upload-content-length": String(fileInfo.size),
      "x-upload-content-type": "video/mp4"
    },
    body: JSON.stringify(metadata)
  });
  if (!session.ok) throw new Error(`YouTube upload session failed (${session.status}): ${await session.text()}`);
  const uploadUrl = session.headers.get("location");
  if (!uploadUrl) throw new Error("YouTube did not return a resumable upload URL.");

  const stream = createReadStream(input.item.outputPath);
  const uploaded = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${input.accessToken}`,
      "content-length": String(fileInfo.size),
      "content-type": path.extname(input.item.outputPath).toLowerCase() === ".mp4" ? "video/mp4" : "application/octet-stream"
    },
    body: stream,
    duplex: "half"
  } as RequestInit & { duplex: "half" });
  const body = await uploaded.json().catch(() => ({})) as { id?: string; error?: { message?: string } };
  if (!uploaded.ok || !body.id) throw new Error(body.error?.message || `YouTube upload failed (${uploaded.status}).`);
  return {
    platform: "youtube",
    status: "published",
    externalId: body.id,
    url: `https://www.youtube.com/watch?v=${body.id}`,
    publishedAt: new Date().toISOString()
  };
}
