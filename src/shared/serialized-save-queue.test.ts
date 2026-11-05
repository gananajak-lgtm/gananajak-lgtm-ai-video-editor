import assert from "node:assert/strict";
import test from "node:test";
import { createSerializedSaveQueue } from "./serialized-save-queue";

test("delayed old save cannot overwrite the newer snapshot", async () => {
  const persisted: string[] = [];
  let releaseFirst: (() => void) | undefined;
  const firstGate = new Promise<void>(resolve => { releaseFirst = resolve; });
  const queue = createSerializedSaveQueue(async (value: string) => {
    if (value === "old") await firstGate;
    persisted.push(value);
  });
  const oldSave = queue("old");
  const newSave = queue("new");
  await Promise.resolve();
  assert.deepEqual(persisted, []);
  releaseFirst!();
  await Promise.all([oldSave, newSave]);
  assert.deepEqual(persisted, ["old", "new"]);
  assert.equal(persisted.at(-1), "new");
});

test("failed save reports error without blocking later edits", async () => {
  const persisted: string[] = [];
  const queue = createSerializedSaveQueue(async (value: string) => {
    if (value === "bad") throw new Error("disk failure");
    persisted.push(value);
  });
  await assert.rejects(queue("bad"), /disk failure/);
  await queue("recovered");
  assert.deepEqual(persisted, ["recovered"]);
});

test("queued writes preserve episode identifiers and invocation order", async () => {
  const persisted: string[] = [];
  const queue = createSerializedSaveQueue(async ({ episode, revision }: { episode: string; revision: number }) => {
    persisted.push(episode + ":" + revision);
  });
  await Promise.all([
    queue({ episode: "ep1", revision: 1 }),
    queue({ episode: "ep2", revision: 1 }),
    queue({ episode: "ep1", revision: 2 })
  ]);
  assert.deepEqual(persisted, ["ep1:1", "ep2:1", "ep1:2"]);
});
