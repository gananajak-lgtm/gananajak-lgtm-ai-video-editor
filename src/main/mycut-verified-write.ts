import { readFile, writeFile, unlink } from "node:fs/promises";
import { assertSerializedMyCutTimeline } from "./mycut-serialized-validation";

type Project = Parameters<typeof assertSerializedMyCutTimeline>[0];

export async function writeVerifiedMyCutProject(destination: string, project: Project): Promise<void> {
  assertSerializedMyCutTimeline(project);
  // Exclusive create, never replace an existing user's edits.
  const expectedJson = JSON.stringify(project, null, 2);
  await writeFile(destination, expectedJson, { flag: "wx" });
  try {
    const actualJson = await readFile(destination, "utf8");
    if (actualJson !== expectedJson) throw new Error("Persisted MyCut project bytes differ from approved data");
    const saved = JSON.parse(actualJson) as Project;
    assertSerializedMyCutTimeline(saved);
    if (saved.dur !== project.dur || saved.clips.length !== project.clips.length ||
        saved.media.length !== project.media.length) {
      throw new Error("Persisted MyCut project differs from approved timeline");
    }
  } catch (error) {
    // Only a newly created output is removed on verification failure.
    await unlink(destination).catch(() => {});
    throw error;
  }
}
