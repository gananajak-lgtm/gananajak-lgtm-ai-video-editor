import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ProjectDocument } from "../shared/types";
import { readProjectFile, writeProject } from "./project-json";

test("writes and reopens a real .aivproj file preserving frame anchors", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "aivproj-test-"));
  try {
    const project: ProjectDocument = {
      schemaVersion: 1, id: "test-project", title: "Thai story",
      createdAt: "2026-10-13T00:00:00Z", updatedAt: "2026-10-13T00:00:00Z",
      images: ["/tmp/scene.png"], narration: null, transcript: null,
      editingPlan: null,
      timeline: {
        duration: 12, narration: "", width: 1080, height: 1920, fps: 30,
        clips: [
          { id: "scene-1", imagePath: "/tmp/scene.png", start: 0, duration: 8, motion: "hold" },
          { id: "scene-2", imagePath: "/tmp/scene-2.png", start: 8, duration: 4, motion: "hold" }
        ],
        audioLayers: [], subtitles: [], transitionDuration: 0, quality: "standard"
      },
      audioLayers: [{
        id: "studio-dialogue:line-001", filePath: "/tmp/line-001.mp3",
        kind: "dialogue", start: 0, duration: 3.2, volume: 1,
        loop: false, fadeIn: 0, fadeOut: 0, origin: "studio-dialogue",
        voiceLineId: "line-001", voiceJobId: "voice-line-001",
        voiceSpeaker: "พรานสิง", voiceEmotion: "กระซิบ", voiceText: "อย่าส่งเสียง",
      }],
      studioFrameAnchors: { "scene-1": "line-001", "scene-2": "line-008" }
    };
    const file = path.join(directory, "nested", "story.aivproj");
    await writeProject(file, project);
    const restored = await readProjectFile(file);
    assert.deepEqual(restored, project);
    assert.equal(restored.timeline?.clips[1].start, 8);
    assert.equal(restored.audioLayers[0].voiceLineId, "line-001");
    assert.equal(restored.audioLayers[0].voiceJobId, "voice-line-001");
    assert.equal(restored.audioLayers[0].voiceSpeaker, "พรานสิง");
    assert.equal(restored.audioLayers[0].voiceEmotion, "กระซิบ");
    assert.equal(restored.audioLayers[0].voiceText, "อย่าส่งเสียง");
    assert.equal(restored.audioLayers[0].start, 0);
    assert.equal(restored.audioLayers[0].duration, 3.2);
    assert.deepEqual(restored.studioFrameAnchors, { "scene-1": "line-001", "scene-2": "line-008" });
    const legacy = { ...project };
    delete legacy.studioFrameAnchors;
    await writeProject(file, legacy);
    assert.deepEqual(await readProjectFile(file), legacy);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test("saving one project does not overwrite another or leave temporary files", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "aivproj-isolation-"));
  try {
    const makeProject = (id: string): ProjectDocument => ({
      schemaVersion: 1, id, title: id, createdAt: "2026-10-13T00:00:00Z",
      updatedAt: "2026-10-13T00:00:00Z", images: [], narration: null,
      transcript: null, editingPlan: null, timeline: null, audioLayers: []
    });
    const firstPath = path.join(directory, "first.aivproj");
    const secondPath = path.join(directory, "second.aivproj");
    const first = makeProject("first");
    const second = makeProject("second");
    await writeProject(firstPath, first);
    await writeProject(secondPath, second);
    const revised = { ...first, title: "ฉบับแก้ไข", updatedAt: "2026-10-13T01:00:00Z" };
    await writeProject(firstPath, revised);
    assert.deepEqual(await readProjectFile(firstPath), revised);
    assert.deepEqual(await readProjectFile(secondPath), second);
    assert.deepEqual((await fs.readdir(directory)).sort(), ["first.aivproj", "second.aivproj"]);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test("rejects malformed .aivproj documents", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "aivproj-invalid-"));
  try {
    const file = path.join(directory, "bad.aivproj");
    await fs.writeFile(file, JSON.stringify({ schemaVersion: 9 }), "utf8");
    await assert.rejects(readProjectFile(file), /invalid/);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test("episode timelines survive EP1 → EP2 → EP1 and application-style reopen", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "studio-episode-isolation-"));
  try {
    const episodePath = (episode: string) => path.join(directory, "studio-projects", "story-1", "episodes", episode, "timeline", "editor.aivproj");
    const document = (episode: string, version: number): ProjectDocument => ({
      schemaVersion: 1, id: "episode-" + episode,
      title: "พิภพเร้นลับ " + episode + " revision " + version,
      createdAt: "2026-10-13T00:00:00Z", updatedAt: "2026-10-13T00:00:00Z",
      images: ["/media/" + episode + "-scene-" + version + ".png"],
      narration: null, transcript: null, editingPlan: null, timeline: null,
      audioLayers: [], studioFrameAnchors: { "shot-1": episode + "-line-" + version }
    });
    const first = episodePath("ep1");
    const second = episodePath("ep2");
    await writeProject(first, document("ep1", 1));
    await writeProject(second, document("ep2", 1));
    assert.equal((await readProjectFile(first)).title, "พิภพเร้นลับ ep1 revision 1");
    await writeProject(first, document("ep1", 2));
    assert.deepEqual(await readProjectFile(second), document("ep2", 1));
    // Reopen both files from disk as after closing and restarting the app.
    assert.deepEqual(await readProjectFile(first), document("ep1", 2));
    assert.deepEqual(await readProjectFile(second), document("ep2", 1));
    assert.equal((await readProjectFile(first)).studioFrameAnchors?.["shot-1"], "ep1-line-2");
    assert.equal((await readProjectFile(second)).studioFrameAnchors?.["shot-1"], "ep2-line-1");
    assert.deepEqual(await fs.readdir(path.dirname(first)), ["editor.aivproj"]);
    assert.deepEqual(await fs.readdir(path.dirname(second)), ["editor.aivproj"]);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test("corrupt target episode does not modify a valid existing episode", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "studio-episode-corrupt-"));
  try {
    const firstPath = path.join(directory, "episodes", "ep1", "timeline", "editor.aivproj");
    const secondPath = path.join(directory, "episodes", "ep2", "timeline", "editor.aivproj");
    const first: ProjectDocument = {
      schemaVersion: 1, id: "episode-ep1", title: "พิภพเร้นลับ EP1",
      createdAt: "2026-10-13T00:00:00Z", updatedAt: "2026-10-13T00:00:00Z",
      images: ["/media/ep1.png"], narration: null, transcript: null,
      editingPlan: null, timeline: null, audioLayers: [],
      studioFrameAnchors: { "shot-1": "line-1" }
    };
    await writeProject(firstPath, first);
    await fs.mkdir(path.dirname(secondPath), { recursive: true });
    await fs.writeFile(secondPath, "{ invalid json", "utf8");
    await assert.rejects(readProjectFile(secondPath));
    assert.deepEqual(await readProjectFile(firstPath), first);
    const revised = { ...first, title: "พิภพเร้นลับ EP1 แก้ไขล่าสุด" };
    await writeProject(firstPath, revised);
    assert.deepEqual(await readProjectFile(firstPath), revised);
    assert.equal(await fs.readFile(secondPath, "utf8"), "{ invalid json");
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test("parallel episode saves use isolated atomic files and leave no temp artifacts", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "studio-episode-parallel-"));
  try {
    const makeDocument = (episode: string, revision: number): ProjectDocument => ({
      schemaVersion: 1, id: "episode-" + episode,
      title: episode + " revision " + revision,
      createdAt: "2026-10-13T00:00:00Z", updatedAt: "2026-10-13T00:00:00Z",
      images: ["/media/" + episode + "-" + revision + ".png"],
      narration: null, transcript: null, editingPlan: null, timeline: null,
      audioLayers: [], studioFrameAnchors: { "shot-1": episode + "-" + revision }
    });
    const first = path.join(directory, "ep1", "timeline", "editor.aivproj");
    const second = path.join(directory, "ep2", "timeline", "editor.aivproj");
    await Promise.all([
      writeProject(first, makeDocument("ep1", 1)),
      writeProject(second, makeDocument("ep2", 1))
    ]);
    assert.deepEqual(await readProjectFile(first), makeDocument("ep1", 1));
    assert.deepEqual(await readProjectFile(second), makeDocument("ep2", 1));
    await Promise.all([
      writeProject(first, makeDocument("ep1", 2)),
      writeProject(second, makeDocument("ep2", 2))
    ]);
    assert.deepEqual(await readProjectFile(first), makeDocument("ep1", 2));
    assert.deepEqual(await readProjectFile(second), makeDocument("ep2", 2));
    assert.deepEqual(await fs.readdir(path.dirname(first)), ["editor.aivproj"]);
    assert.deepEqual(await fs.readdir(path.dirname(second)), ["editor.aivproj"]);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test("serialized autosaves persist the newest same-EP snapshot to disk", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "studio-episode-queued-"));
  try {
    const { createSerializedSaveQueue } = await import("../shared/serialized-save-queue");
    const file = path.join(directory, "ep1", "timeline", "editor.aivproj");
    const makeDocument = (revision: number): ProjectDocument => ({
      schemaVersion: 1, id: "episode-ep1", title: "พิภพเร้นลับ EP1 revision " + revision,
      createdAt: "2026-10-13T00:00:00Z", updatedAt: "2026-10-13T00:00:00Z",
      images: ["/media/ep1-" + revision + ".png"], narration: null,
      transcript: null, editingPlan: null, timeline: null, audioLayers: [],
      studioFrameAnchors: { "shot-1": "line-" + revision }
    });
    let releaseFirst: (() => void) | undefined;
    const gate = new Promise<void>(resolve => { releaseFirst = resolve; });
    const save = createSerializedSaveQueue(async (revision: number) => {
      if (revision === 1) await gate;
      await writeProject(file, makeDocument(revision));
    });
    const first = save(1);
    const second = save(2);
    await Promise.resolve();
    releaseFirst!();
    await Promise.all([first, second]);
    assert.deepEqual(await readProjectFile(file), makeDocument(2));
    assert.deepEqual(await fs.readdir(path.dirname(file)), ["editor.aivproj"]);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test("EP1 → EP2 → EP1 saves preserve newest snapshots even with a pending old EP1 write", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "studio-ep-switch-queue-"));
  try {
    const { createSerializedSaveQueue } = await import("../shared/serialized-save-queue");
    const fileFor = (episode: string) => path.join(directory, episode, "timeline", "editor.aivproj");
    const makeDocument = (episode: string, revision: number): ProjectDocument => ({
      schemaVersion: 1, id: "episode-" + episode,
      title: episode + " revision " + revision,
      createdAt: "2026-10-14T00:00:00Z", updatedAt: "2026-10-14T00:00:00Z",
      images: ["/media/" + episode + "-" + revision + ".png"],
      narration: null, transcript: null, editingPlan: null, timeline: null,
      audioLayers: [], studioFrameAnchors: { "shot-1": episode + "-line-" + revision }
    });
    let releaseFirst: (() => void) | undefined;
    const gate = new Promise<void>(resolve => { releaseFirst = resolve; });
    const save = createSerializedSaveQueue(async ({ episode, revision }: { episode: string; revision: number }) => {
      if (episode === "ep1" && revision === 1) await gate;
      await writeProject(fileFor(episode), makeDocument(episode, revision));
    });
    const first = save({ episode: "ep1", revision: 1 });
    const second = save({ episode: "ep2", revision: 1 });
    const third = save({ episode: "ep1", revision: 2 });
    await Promise.resolve();
    releaseFirst!();
    await Promise.all([first, second, third]);
    assert.deepEqual(await readProjectFile(fileFor("ep1")), makeDocument("ep1", 2));
    assert.deepEqual(await readProjectFile(fileFor("ep2")), makeDocument("ep2", 1));
    assert.deepEqual(await fs.readdir(path.dirname(fileFor("ep1"))), ["editor.aivproj"]);
    assert.deepEqual(await fs.readdir(path.dirname(fileFor("ep2"))), ["editor.aivproj"]);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("two Studio projects keep same-named EP timelines isolated across reopen", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "studio-two-projects-"));
  try {
    const makeDocument = (project: string, revision: number): ProjectDocument => ({
      schemaVersion: 1, id: "episode-" + project + "-ep1",
      title: project + " EP1 revision " + revision,
      createdAt: "2026-10-14T00:00:00Z", updatedAt: "2026-10-14T00:00:00Z",
      images: ["/media/" + project + "/shot-" + revision + ".png"],
      narration: null, transcript: null, editingPlan: null, timeline: null,
      audioLayers: [], studioFrameAnchors: { "shot-1": project + "-line-" + revision }
    });
    const episodePath = (project: string) => path.join(directory, "studio-projects", project,
      "episodes", "ep1", "timeline", "editor.aivproj");
    const first = episodePath("phiphop");
    const second = episodePath("other-story");
    await writeProject(first, makeDocument("phiphop", 1));
    await writeProject(second, makeDocument("other-story", 1));
    await writeProject(first, makeDocument("phiphop", 2));
    assert.deepEqual(await readProjectFile(first), makeDocument("phiphop", 2));
    assert.deepEqual(await readProjectFile(second), makeDocument("other-story", 1));
    await writeProject(second, makeDocument("other-story", 2));
    assert.deepEqual(await readProjectFile(first), makeDocument("phiphop", 2));
    assert.deepEqual(await readProjectFile(second), makeDocument("other-story", 2));
    assert.deepEqual(await fs.readdir(path.dirname(first)), ["editor.aivproj"]);
    assert.deepEqual(await fs.readdir(path.dirname(second)), ["editor.aivproj"]);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("wrong-episode saved file is rejected without changing the original EP", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "studio-wrong-ep-"));
  try {
    const { assertStudioEpisodeIdentity } = await import("../shared/studio-episode-identity");
    const document = (episode: string): ProjectDocument => ({
      schemaVersion: 1, id: "episode-" + episode, title: episode,
      createdAt: "2026-10-14T00:00:00Z", updatedAt: "2026-10-14T00:00:00Z",
      images: [], narration: null, transcript: null, editingPlan: null,
      timeline: null, audioLayers: []
    });
    const original = path.join(directory, "ep1", "timeline", "editor.aivproj");
    const wrongTarget = path.join(directory, "ep2", "timeline", "editor.aivproj");
    await writeProject(original, document("ep1"));
    // Simulate an accidentally copied EP1 file into the EP2 folder.
    await writeProject(wrongTarget, document("ep1"));
    const loaded = await readProjectFile(wrongTarget);
    assert.throws(() => assertStudioEpisodeIdentity(loaded.id, "ep2"), /EP อื่น/);
    assert.deepEqual(await readProjectFile(original), document("ep1"));
    assert.deepEqual(await readProjectFile(wrongTarget), document("ep1"));
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("dragged Studio dialogue timing survives save, reopen, and a second edit without changing MP3 metadata", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "studio-dialogue-timing-"));
  const file = path.join(directory, "ep1", "timeline", "editor.aivproj");
  try {
    const initial: ProjectDocument = {
      schemaVersion: 1, id: "episode-ep1", title: "EP 1",
      createdAt: "2026-10-18T00:00:00Z", updatedAt: "2026-10-18T00:00:00Z",
      images: [], narration: null, transcript: null, editingPlan: null,
      timeline: null,
      audioLayers: [
        { id: "studio-dialogue:ep1:line-1", filePath: "/voice/line-1.mp3", kind: "dialogue", origin: "studio-dialogue", voiceLineId: "line-1", voiceJobId: "v4-job-1", start: 0, duration: 1.5, volume: 1, loop: false, fadeIn: 0, fadeOut: 0 },
        { id: "studio-dialogue:ep1:line-2", filePath: "/voice/line-2.mp3", kind: "dialogue", origin: "studio-dialogue", voiceLineId: "line-2", voiceJobId: "v4-job-2", start: 2, duration: 2, volume: 1, loop: false, fadeIn: 0, fadeOut: 0 }
      ]
    };
    await writeProject(file, initial);
    const before = await readProjectFile(file);
    const moved = { ...before, audioLayers: before.audioLayers.map(layer => layer.voiceLineId === "line-2" ? { ...layer, start: 2.7 } : layer) };
    await writeProject(file, moved);
    const reopened = await readProjectFile(file);
    assert.equal(reopened.audioLayers.find(layer => layer.voiceLineId === "line-2")?.start, 2.7);
    assert.deepEqual(reopened.audioLayers.map(({ filePath, voiceJobId, duration }) => ({ filePath, voiceJobId, duration })), initial.audioLayers.map(({ filePath, voiceJobId, duration }) => ({ filePath, voiceJobId, duration })));
    await writeProject(file, { ...reopened, audioLayers: reopened.audioLayers.map(layer => layer.voiceLineId === "line-2" ? { ...layer, start: 3.1 } : layer) });
    assert.equal((await readProjectFile(file)).audioLayers[1].start, 3.1);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
