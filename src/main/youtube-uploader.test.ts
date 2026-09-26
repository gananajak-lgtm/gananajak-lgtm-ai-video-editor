import assert from "node:assert/strict";
import test from "node:test";
import { describeYouTubeUploadError } from "./youtube-uploader";

test("maps YouTube authorization and quota errors to actionable messages",()=>{
  assert.match(describeYouTubeUploadError(401),/Reconnect YouTube/i);
  assert.match(describeYouTubeUploadError(403,"quotaExceeded"),/permissions|quota/i);
  assert.match(describeYouTubeUploadError(429),/retry later/i);
  assert.match(describeYouTubeUploadError(503),/temporarily unavailable/i);
});
