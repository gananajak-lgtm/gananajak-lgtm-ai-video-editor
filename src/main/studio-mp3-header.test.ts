import assert from "node:assert/strict";
import test from "node:test";
import { hasPlausibleMp3Header } from "./studio-mp3-header";

test("recognizes valid ID3 and MPEG frame signatures", () => {
  assert.equal(hasPlausibleMp3Header(Buffer.from([0x49,0x44,0x33,0x04,0x00,0x00,0,0,0,0])), true);
  assert.equal(hasPlausibleMp3Header(Buffer.from([0xff,0xfb,0x90,0x64])), true);
});
test("rejects empty, truncated, plain text and malformed MP3 headers", () => {
  for (const bytes of [
    Buffer.alloc(0), Buffer.from([0xff,0xfb]), Buffer.from("not an mp3"),
    Buffer.from([0x49,0x44,0x33,0x04,0x00,0x00,0x80,0,0,0]),
    Buffer.from([0xff,0xeb,0x90,0x64]),
    Buffer.from([0xff,0xfb,0xf0,0x64])
  ]) assert.equal(hasPlausibleMp3Header(bytes), false);
});
