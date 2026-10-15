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
    // Wrong-episode identity must reject before a target is adopted.
    const wrongEpisode = "ep2";
    assert.throws(
      () => assertStudioEpisodeIdentity("episode-ep1", wrongEpisode),
      /EP อื่น/
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
    await assert.rejects(
      studio.saveStudioEpisodeEditor(project.id, episode.id, { ...editor, id: "episode-not-this-episode" }),
      /EP อื่น/,
      "storage must reject a mismatched EP identity"
    );
    await assert.rejects(
      studio.saveStudioEpisodeEditor(project.id, episode.id, { ...editor, id: "legacy-document" }),
      /รหัสไทม์ไลน์ไม่ตรงกับ EP/,
      "legacy identity must be normalized by the editor before saving"
    );
    assert.deepEqual(await studio.loadStudioEpisodeEditor(project.id, episode.id), editor);
    // Nonexistent destinations must fail without creating an orphan timeline.
    const unknownEpisodeId = "00000000-0000-4000-8000-000000000001";
    await assert.rejects(
      studio.saveStudioEpisodeEditor(project.id, unknownEpisodeId, { ...editor, id: "episode-" + unknownEpisodeId }),
      /Episode not found/
    );
    await assert.rejects(
      fs.access(path.join(project.folder, "episodes", unknownEpisodeId, "timeline", "editor.aivproj"))
    );
    assert.deepEqual(await studio.loadStudioEpisodeEditor(project.id, episode.id), editor);


    // Exercise the production Studio API with two episodes: save, switch,
    // reopen, revise EP1 and verify EP2 remains unchanged.
    const secondEpisode = await studio.createStudioEpisode(project.id, "EP 2");
    const secondScript = "พรานอิน: ไปกันเถอะ";
    await studio.saveStudioEpisodeScript(project.id, secondEpisode.id, secondScript);
    const secondEditor = { ...editor, id: "episode-" + secondEpisode.id, title: "พิภพเร้นลับ EP 2" };
    await studio.saveStudioEpisodeEditor(project.id, secondEpisode.id, secondEditor);
    const revisedEditor = { ...editor, title: "พิภพเร้นลับ EP 1 ฉบับแก้ไข" };
    await studio.saveStudioEpisodeEditor(project.id, episode.id, revisedEditor);
    assert.deepEqual(await studio.loadStudioEpisodeEditor(project.id, episode.id), revisedEditor);
    assert.deepEqual(await studio.loadStudioEpisodeEditor(project.id, secondEpisode.id), secondEditor);
    assert.equal(await studio.loadStudioEpisodeScript(project.id, episode.id), script);
    assert.equal(await studio.loadStudioEpisodeScript(project.id, secondEpisode.id), secondScript);
    await studio.deleteStudioEpisode(project.id, secondEpisode.id);
    const extraTrash = (await studio.listStudioTrash()).find(item => item.kind === "episode" && item.episodeId === secondEpisode.id);
    assert.ok(extraTrash);
    await studio.restoreStudioTrash("episode", extraTrash.archiveId);
    assert.deepEqual(await studio.loadStudioEpisodeEditor(project.id, secondEpisode.id), secondEditor);
    await studio.saveStudioEpisodeEditor(project.id, episode.id, editor);
    await studio.deleteStudioEpisode(project.id, episode.id);
    assert.deepEqual((await studio.listStudioProjects())[0].episodes.map(item => item.id), [secondEpisode.id]);
    let trash = await studio.listStudioTrash();
    const archivedEpisode = trash.find(item => item.kind === "episode" && item.episodeId === episode.id);
    assert.ok(archivedEpisode, "episode should be recoverable");
    await studio.restoreStudioTrash("episode", archivedEpisode.archiveId);
    assert.equal(await studio.loadStudioEpisodeScript(project.id, episode.id), script);
    assert.deepEqual(await studio.loadStudioEpisodeEditor(project.id, episode.id), editor);
    await assert.rejects(fs.access(path.join(episode.folder, ".studio-deleted.json")));
    assert.deepEqual((await studio.listStudioProjects())[0].episodes.map(item => item.id), [episode.id, secondEpisode.id]);
    await studio.deleteStudioProject(project.id);
    assert.equal((await studio.listStudioProjects()).length, 0);
    trash = await studio.listStudioTrash();
    const archivedProject = trash.find(item => item.kind === "project" && item.projectId === project.id);
    assert.ok(archivedProject, "project should be recoverable");
    await studio.restoreStudioTrash("project", archivedProject.archiveId);
    const restored = await studio.listStudioProjects();
    assert.equal(restored.length, 1);
    assert.deepEqual(new Set(restored[0].episodes.map(item => item.id)), new Set([episode.id, secondEpisode.id]));
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
