import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { ContentBatchItem, PublishResult } from "../shared/content-factory";

export type YouTubeUploadInput = {
  accessToken: string;
  item: ContentBatchItem;
  privacyStatus?: "private" | "unlisted" | "public";
};

export async function uploadVideoToYouTube(input: YouTubeUploadInput): Promise<PublishResult> {
  if (!input.item.outputPath) throw new Error("Rendered video path is missing.");
  const fileInfo = await stat(input.item.outputPath);
  if (!fileInfo.isFile()) throw new Error("Rendered video file cannot be found.");
  const plan = input.item.publish;
  if (!plan?.title?.trim()) throw new Error("YouTube title is required.");

  const metadata = {
    snippet: {
      title: plan.title.trim(),
      description: [plan.description?.trim(), ...(plan.hashtags ?? []).map((tag) => `#${tag.replace(/^#/, "")}`)].filter(Boolean).join("\n\n"),
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

  const bytes = await readFile(input.item.outputPath);
  const uploaded = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${input.accessToken}`,
      "content-length": String(bytes.byteLength),
      "content-type": path.extname(input.item.outputPath).toLowerCase() === ".mp4" ? "video/mp4" : "application/octet-stream"
    },
    body: bytes
  });
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
