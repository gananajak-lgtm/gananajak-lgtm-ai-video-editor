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
        voiceLineId: "line-001"
      }],
      studioFrameAnchors: { "scene-1": "line-001", "scene-2": "line-008" }
    };
    const file = path.join(directory, "nested", "story.aivproj");
    await writeProject(file, project);
    const restored = await readProjectFile(file);
    assert.deepEqual(restored, project);
    assert.equal(restored.timeline?.clips[1].start, 8);
    assert.equal(restored.audioLayers[0].voiceLineId, "line-001");
    const legacy = { ...project };
    delete legacy.studioFrameAnchors;
    await writeProject(file, legacy);
    assert.deepEqual(await readProjectFile(file), legacy);
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
