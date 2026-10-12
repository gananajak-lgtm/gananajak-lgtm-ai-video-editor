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
      editingPlan: null, timeline: null, audioLayers: [],
      studioFrameAnchors: { "scene-1": "line-001", "scene-2": "line-008" }
    };
    const file = path.join(directory, "nested", "story.aivproj");
    await writeProject(file, project);
    assert.deepEqual(await readProjectFile(file), project);
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
