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
    const { assertStudioEpisodeIdentity } = require("../dist-electron/src/shared/studio-episode-identity.js");
    const episodeId = "ep-expected";
    assert.doesNotThrow(() => assertStudioEpisodeIdentity("episode-" + episodeId, episodeId));
    assert.doesNotThrow(() => assertStudioEpisodeIdentity("legacy-document", episodeId));
    assert.doesNotThrow(() => assertStudioEpisodeIdentity(undefined, episodeId));
    assert.throws(
      () => assertStudioEpisodeIdentity("episode-ep-other", episodeId),
      /EP อื่น/,
      "a persisted document belonging to another episode must be rejected"
    );
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

    // A restored project must not replace or change an unrelated project's data.
    const other = await studio.createStudioProject("อีกเรื่องหนึ่ง");
    const otherEpisode = await studio.createStudioEpisode(other.id, "EP 2");
    const otherScript = "ตัวละครอื่น: บทของอีกโปรเจกต์";
    await studio.saveStudioEpisodeScript(other.id, otherEpisode.id, otherScript);
    await studio.deleteStudioProject(project.id);
    assert.equal((await studio.listStudioProjects()).length, 1);
    assert.equal(await studio.loadStudioEpisodeScript(other.id, otherEpisode.id), otherScript);
    const secondTrash = (await studio.listStudioTrash()).find(item => item.kind === "project" && item.projectId === project.id);
    assert.ok(secondTrash, "deleted original must remain independently restorable");
    await studio.restoreStudioTrash("project", secondTrash.archiveId);
    assert.equal((await studio.listStudioProjects()).length, 2);
    assert.equal(await studio.loadStudioEpisodeScript(project.id, episode.id), script);
    assert.equal(await studio.loadStudioEpisodeScript(other.id, otherEpisode.id), otherScript);
    assert.deepEqual(await studio.loadStudioEpisodeEditor(project.id, episode.id), editor);
    await assert.rejects(
      studio.restoreStudioTrash("project", secondTrash.archiveId),
      /ENOENT/,
      "restoring the same trash entry twice must not duplicate a project"
    );
    assert.equal((await studio.listStudioProjects()).length, 2);
    // Tampered archive metadata must not redirect restored files to another folder.
    await studio.deleteStudioEpisode(other.id, otherEpisode.id);
    const tampered = (await studio.listStudioTrash()).find(item =>
      item.kind === "episode" && item.episodeId === otherEpisode.id
    );
    assert.ok(tampered, "deleted second episode must appear in trash");
    const metadataPath = path.join(
      userData, "studio-projects", ".trash", "episodes", tampered.archiveId, ".studio-deleted.json"
    );
    const originalMetadata = await fs.readFile(metadataPath, "utf8");
    const metadata = JSON.parse(originalMetadata);
    metadata.episode.folder = path.join(userData, "unexpected-folder");
    await fs.writeFile(metadataPath, JSON.stringify(metadata), "utf8");
    assert.ok(!(await studio.listStudioTrash()).some(item => item.archiveId === tampered.archiveId));
    await assert.rejects(studio.restoreStudioTrash("episode", tampered.archiveId));
    assert.equal((await studio.listStudioProjects()).length, 2);
    assert.equal((await studio.listStudioProjects()).find(item => item.id === other.id).episodes.length, 0);
    await fs.writeFile(metadataPath, originalMetadata, "utf8");
    await studio.restoreStudioTrash("episode", tampered.archiveId);
    assert.equal(await studio.loadStudioEpisodeScript(other.id, otherEpisode.id), otherScript);
    assert.equal(await studio.loadStudioEpisodeScript(project.id, episode.id), script);
    console.log("Studio recovery, cross-project isolation and tamper rejection passed.");
  } finally {
    await fs.rm(userData, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
