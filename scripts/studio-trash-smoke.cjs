"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");

async function main() {
  const userData = await fs.mkdtemp(path.join(os.tmpdir(), "studio-trash-smoke-"));
  const originalLoad = Module._load;
  Module._load = function(request, parent, isMain) {
    if (request === "electron") return { app: { getPath: () => userData } };
    return originalLoad.call(this, request, parent, isMain);
  };
  let studio;
  try {
    studio = require("../dist-electron/src/main/studio-projects.js");
  } finally {
    Module._load = originalLoad;
  }
  try {
    const project = await studio.createStudioProject("พิภพเร้นลับ");
    const episode = await studio.createStudioEpisode(project.id, "EP 1");
    const script = "พรานสิง: อย่าส่งเสียง";
    await studio.saveStudioEpisodeScript(project.id, episode.id, script);
    const editor = {
      schemaVersion: 1, id: "episode-" + episode.id, title: "พิภพเร้นลับ EP 1",
      createdAt: "2026-10-14T00:00:00Z", updatedAt: "2026-10-14T00:00:00Z",
      images: [], narration: null, transcript: null, editingPlan: null,
      timeline: null, audioLayers: [], studioFrameAnchors: {}
    };
    await studio.saveStudioEpisodeEditor(project.id, episode.id, editor);
    await studio.deleteStudioEpisode(project.id, episode.id);
    assert.equal((await studio.listStudioProjects())[0].episodes.length, 0);
    let trash = await studio.listStudioTrash();
    const archivedEpisode = trash.find(item => item.kind === "episode" && item.episodeId === episode.id);
    assert.ok(archivedEpisode, "episode should be recoverable");
    await studio.restoreStudioTrash("episode", archivedEpisode.archiveId);
    assert.equal(await studio.loadStudioEpisodeScript(project.id, episode.id), script);
    assert.deepEqual(await studio.loadStudioEpisodeEditor(project.id, episode.id), editor);
    await assert.rejects(fs.access(path.join(episode.folder, ".studio-deleted.json")));
    assert.equal((await studio.listStudioProjects())[0].episodes.length, 1);
    await studio.deleteStudioProject(project.id);
    assert.equal((await studio.listStudioProjects()).length, 0);
    trash = await studio.listStudioTrash();
    const archivedProject = trash.find(item => item.kind === "project" && item.projectId === project.id);
    assert.ok(archivedProject, "project should be recoverable");
    await studio.restoreStudioTrash("project", archivedProject.archiveId);
    const restored = await studio.listStudioProjects();
    assert.equal(restored.length, 1);
    assert.equal(restored[0].episodes[0].id, episode.id);
    assert.equal(await studio.loadStudioEpisodeScript(project.id, episode.id), script);
    assert.deepEqual(await studio.loadStudioEpisodeEditor(project.id, episode.id), editor);
    await assert.rejects(fs.access(path.join(project.folder, ".studio-deleted.json")));
    assert.equal((await studio.listStudioTrash()).length, 0);
    console.log("Studio create/delete/restore disk round-trip passed.");
  } finally {
    await fs.rm(userData, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
