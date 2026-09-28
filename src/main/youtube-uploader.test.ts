import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { ContentBatchItem } from "../shared/content-factory";
import { describeYouTubeUploadError, uploadVideoToYouTube } from "./youtube-uploader";

test("maps YouTube authorization and quota errors to actionable messages",()=>{
  assert.match(describeYouTubeUploadError(401),/Reconnect YouTube/i);
  assert.match(describeYouTubeUploadError(403,"quotaExceeded"),/permissions|quota/i);
  assert.match(describeYouTubeUploadError(429),/retry later/i);
  assert.match(describeYouTubeUploadError(503),/temporarily unavailable/i);
});

test("uploads a rendered MP4 through a mocked resumable YouTube session", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "youtube-uploader-test-"));
  t.after(async () => { await rm(root, { recursive:true, force:true }); });
  const outputPath = path.join(root, "video.mp4");
  await writeFile(outputPath, Buffer.from("fake-mp4"));

  const item: ContentBatchItem = {
    id:"item-1",
    brief:{ topic:"test upload", format:"short", language:"en", targetDurationSeconds:30 },
    status:"rendered",
    outputPath,
    publish:{
      status:"ready",
      title:"Private upload test",
      description:"Mocked upload",
      hashtags:["test"],
      platforms:["youtube"]
    }
  };

  const originalFetch = globalThis.fetch;
  const requests: Array<{ url:string; init?:RequestInit }> = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    requests.push({ url, init });
    if (requests.length === 1) {
      return new Response("", { status:200, headers:{ location:"https://upload.example.test/session-1" } });
    }
    return new Response(JSON.stringify({ id:"yt_mock_123" }), { status:200, headers:{ "content-type":"application/json" } });
  }) as typeof fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  const result = await uploadVideoToYouTube({ accessToken:"mock-token", item });

  assert.equal(requests.length, 2);
  assert.match(requests[0].url, /upload\/youtube\/v3\/videos\?uploadType=resumable&part=snippet,status/);
  assert.equal(requests[0].init?.method, "POST");
  const metadata = JSON.parse(String(requests[0].init?.body));
  assert.equal(metadata.status.privacyStatus, "private");
  assert.equal(metadata.snippet.title, "Private upload test");
  assert.equal(requests[1].url, "https://upload.example.test/session-1");
  assert.equal(requests[1].init?.method, "PUT");
  assert.equal(result.status, "published");
  assert.equal(result.externalId, "yt_mock_123");
  assert.equal(result.url, "https://www.youtube.com/watch?v=yt_mock_123");
  assert.ok(result.publishedAt);
});

test("surfaces mocked YouTube session failures without contacting YouTube", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "youtube-uploader-error-test-"));
  t.after(async () => { await rm(root, { recursive:true, force:true }); });
  const outputPath = path.join(root, "video.mp4");
  await writeFile(outputPath, Buffer.from("fake-mp4"));
  const item: ContentBatchItem = {
    id:"item-2",
    brief:{ topic:"test failure", format:"short", language:"en", targetDurationSeconds:30 },
    status:"rendered",
    outputPath,
    publish:{ status:"ready", title:"Failure test", platforms:["youtube"] }
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response("quotaExceeded", { status:403 })) as typeof fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  await assert.rejects(
    uploadVideoToYouTube({ accessToken:"mock-token", item }),
    /permissions|quota/i
  );
});
