import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { writeVerifiedMyCutProject } from "./mycut-verified-write";

const project = () => ({
  dur: 2.3,
  media: [
    { id: "m1", kind: "audio", path: "one.mp3" },
    { id: "m2", kind: "audio", path: "two.mp3" },
    { id: "m3", kind: "image", path: "frame.png" }
  ],
  clips: [
    { id: "c1", kind: "audio", track: "A1", mediaId: "m1", path: "one.mp3", start: 0, dur: 1 },
    { id: "c2", kind: "audio", track: "A1", mediaId: "m2", path: "two.mp3", start: 1.3, dur: 1 },
    { id: "c3", kind: "image", track: "V1", mediaId: "m3", path: "frame.png", start: 0, dur: 2.3 }
  ]
});

test("native MyCut saved JSON reads back with valid A1/V1 structure", async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mycut-verified-write-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const destination = path.join(dir, "new.mycut");
  await writeVerifiedMyCutProject(destination, project());
  const saved = JSON.parse(await readFile(destination, "utf8"));
  assert.equal(saved.clips.length, 3);
  assert.equal(saved.dur, 2.3);
  assert.equal(await readFile(destination, "utf8"), JSON.stringify(project(), null, 2));
  await assert.rejects(writeVerifiedMyCutProject(destination, project()), /EEXIST/);
});

test("native MyCut writer refuses malformed projects without creating output", async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mycut-invalid-write-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const destination = path.join(dir, "invalid.mycut");
  const invalid = project();
  invalid.clips[2].path = "mismatched.png";
  await assert.rejects(writeVerifiedMyCutProject(destination, invalid), /media references/);
  await assert.rejects(readFile(destination), /ENOENT/);
});

test("native MyCut writer never overwrites existing user project bytes", async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mycut-preserve-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const destination = path.join(dir, "existing.mycut");
  await writeFile(destination, "keep existing edits exactly");
  await assert.rejects(writeVerifiedMyCutProject(destination, project()), /EEXIST/);
  assert.equal(await readFile(destination, "utf8"), "keep existing edits exactly");
});

test("native MyCut writer persists a 60-line A1 and 20-shot contiguous V1 chapter", async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mycut-long-write-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const destination = path.join(dir, "chapter.mycut");
  const media: Array<{ id: string; kind: string; path: string }> = [];
  const clips: Array<{ id: string; kind: string; track: string; mediaId: string; path: string; start: number; dur: number }> = [];
  const starts: number[] = [];
  let total = 0;
  for (let i = 0; i < 60; i++) {
    const id = "audio-" + i, file = path.join(dir, id + ".mp3");
    const duration = 1 + (i % 5) * 0.125;
    starts.push(total);
    await writeFile(file, "ID3fixture");
    media.push({ id, kind: "audio", path: file });
    clips.push({ id: "clip-" + id, kind: "audio", track: "A1", mediaId: id, path: file, start: total, dur: duration });
    total += duration + (i === 59 ? 0 : 0.3);
  }
  for (let i = 0; i < 20; i++) {
    const id = "image-" + i, file = path.join(dir, id + ".png");
    const start = starts[i * 3], end = i === 19 ? total : starts[(i + 1) * 3];
    await writeFile(file, "image fixture");
    media.push({ id, kind: "image", path: file });
    clips.push({ id: "clip-" + id, kind: "image", track: "V1", mediaId: id, path: file, start, dur: end - start });
  }
  await writeVerifiedMyCutProject(destination, { dur: total, media, clips });
  const saved = JSON.parse(await readFile(destination, "utf8"));
  assert.equal(saved.clips.length, 80);
  assert.equal(saved.media.length, 80);
  for (const item of saved.media) {
    assert.ok(path.isAbsolute(item.path), "serialized media uses absolute path");
    assert.ok((await readFile(item.path)).length > 0, "serialized asset exists on disk");
  }
  for (const clip of saved.clips) {
    assert.equal(saved.media.find((item: {id: string}) => item.id === clip.mediaId)?.path, clip.path);
  }
  assert.equal(saved.clips.filter((clip: {track: string}) => clip.track === "V1").length, 20);
  assert.equal(saved.dur, total);
});
