import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { ProjectDocument } from "../shared/types";

export function isProjectDocument(value: unknown): value is ProjectDocument {
  if (!value || typeof value !== "object") return false;
  const project = value as Partial<ProjectDocument>;
  return project.schemaVersion === 1 && typeof project.id === "string" &&
    typeof project.title === "string" && typeof project.createdAt === "string" &&
    typeof project.updatedAt === "string" && Array.isArray(project.images) &&
    (project.narration === null || typeof project.narration === "string") &&
    Array.isArray(project.audioLayers);
}

export async function readProjectFile(filePath: string): Promise<ProjectDocument> {
  const parsed: unknown = JSON.parse(await fs.readFile(filePath, "utf8"));
  if (!isProjectDocument(parsed)) throw new Error("This project file is invalid or was created by an unsupported editor version.");
  return parsed;
}

export async function writeProject(filePath: string, project: ProjectDocument): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  // Write beside the destination so interrupted saves do not truncate the previous project.
  const temporaryPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}-${randomUUID()}.tmp`);
  try {
    await fs.writeFile(temporaryPath, JSON.stringify(project, null, 2), { encoding: "utf8", flag: "wx" });
    await fs.rename(temporaryPath, filePath);
  } finally {
    await fs.rm(temporaryPath, { force: true });
  }
}
