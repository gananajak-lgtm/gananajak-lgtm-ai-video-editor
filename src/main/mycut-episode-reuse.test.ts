import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fingerprintMyCutEpisodeImport, lookupMyCutEpisodeImport, rememberMyCutEpisodeImport } from "./mycut-episode-reuse";

test("unchanged episode reopens its MyCut project without overwriting an edited project", async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), "mycut-reuse-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "projects"));
  const audio = path.join(root, "line.mp3"), image = path.join(root, "shot.png");
  await writeFile(audio, "ID3 test bytes");
  await writeFile(image, "png fixture bytes");
  const lines = [{ lineId: "line-1", audio, duration: 1.5 }];
  const hash = await fingerprintMyCutEpisodeImport("story", "ep1", ["line-1"], [image], lines);
  const id = "p-12345678-1234-1234-1234-123456789abc";
  await writeFile(path.join(root, "projects", id + ".json"), '{"userEdited":true}');
  await rememberMyCutEpisodeImport(root, hash, id);
  assert.equal(await lookupMyCutEpisodeImport(root, hash), id);
  assert.equal(await lookupMyCutEpisodeImport(root, "x".repeat(64)), null);
  await writeFile(image, "modified image data");
  const changed = await fingerprintMyCutEpisodeImport("story", "ep1", ["line-1"], [image], lines);
  assert.notEqual(changed, hash);
  assert.equal(await lookupMyCutEpisodeImport(root, changed), null);
});

test("missing projects and missing media never yield reusable exports", async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), "mycut-reuse-missing-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const audio = path.join(root, "line.mp3");
  await writeFile(audio, "ID3 test");
  const lines = [{ lineId: "line-1", audio, duration: 2 }];
  await assert.rejects(fingerprintMyCutEpisodeImport("story", "ep", ["missing"], [], lines), /Missing verified MP3/);
  await assert.rejects(fingerprintMyCutEpisodeImport("story", "ep", ["line-1"], [path.join(root,"missing.png")], lines));
  const hash = await fingerprintMyCutEpisodeImport("story", "ep", ["line-1"], [], lines);
  await rememberMyCutEpisodeImport(root, hash, "p-12345678-1234-1234-1234-123456789abc");
  assert.equal(await lookupMyCutEpisodeImport(root, hash), null);
});
