import { app, dialog } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import type {
  ProjectDocument,
  ProjectLoadResult,
  ProjectSaveResult
} from "../shared/types";

const AUTOSAVE_FILE = "autosave.aivproj";
const SCHEMA_VERSION = 1;

function autosavePath() {
  return path.join(app.getPath("userData"), AUTOSAVE_FILE);
}

function safeProjectName(title: string) {
  const cleaned = title
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]+/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 80);

  return cleaned || "story-project";
}

function isProjectDocument(value: unknown): value is ProjectDocument {
  if (!value || typeof value !== "object") return false;

  const project = value as Partial<ProjectDocument>;
  return (
    project.schemaVersion === SCHEMA_VERSION &&
    typeof project.id === "string" &&
    typeof project.title === "string" &&
    typeof project.createdAt === "string" &&
    typeof project.updatedAt === "string" &&
    Array.isArray(project.images) &&
    (project.narration === null || typeof project.narration === "string") &&
    Array.isArray(project.audioLayers)
  );
}

async function readProjectFile(filePath: string) {
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;

  if (!isProjectDocument(parsed)) {
    throw new Error(
      "This project file is invalid or was created by an unsupported editor version."
    );
  }

  return parsed;
}

function mediaPaths(project: ProjectDocument) {
  const paths = new Set<string>();

  for (const image of project.images) paths.add(image);
  if (project.narration) paths.add(project.narration);

  for (const layer of project.audioLayers) {
    paths.add(layer.filePath);
  }

  for (const clip of project.timeline?.clips ?? []) {
    paths.add(clip.imagePath);
  }

  return [...paths];
}

async function findMissingMedia(project: ProjectDocument) {
  const missing: string[] = [];

  await Promise.all(
    mediaPaths(project).map(async (filePath) => {
      try {
        await fs.access(filePath);
      } catch {
        missing.push(filePath);
      }
    })
  );

  return missing.sort((a, b) => a.localeCompare(b));
}

async function loadResult(
  project: ProjectDocument,
  filePath: string | null
): Promise<ProjectLoadResult> {
  return {
    project,
    filePath,
    missingMedia: await findMissingMedia(project)
  };
}

async function writeProject(filePath: string, project: ProjectDocument) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(project, null, 2), "utf8");
}

export async function openProject(): Promise<ProjectLoadResult | null> {
  const result = await dialog.showOpenDialog({
    title: "Open AI Video Editor project",
    properties: ["openFile"],
    filters: [
      { name: "AI Video Editor Project", extensions: ["aivproj"] },
      { name: "JSON", extensions: ["json"] }
    ]
  });

  if (result.canceled || !result.filePaths[0]) return null;

  const filePath = result.filePaths[0];
  const project = await readProjectFile(filePath);
  return loadResult(project, filePath);
}

export async function saveProject(
  project: ProjectDocument,
  currentPath?: string | null
): Promise<ProjectSaveResult | null> {
  let filePath = currentPath ?? null;

  if (!filePath) {
    const result = await dialog.showSaveDialog({
      title: "Save AI Video Editor project",
      defaultPath: `${safeProjectName(project.title)}.aivproj`,
      filters: [
        { name: "AI Video Editor Project", extensions: ["aivproj"] }
      ]
    });

    if (result.canceled || !result.filePath) return null;
    filePath = result.filePath;
  }

  await writeProject(filePath, project);
  return { filePath };
}

export async function autosaveProject(project: ProjectDocument) {
  await writeProject(autosavePath(), project);
}

export async function loadAutosaveProject(): Promise<ProjectLoadResult | null> {
  try {
    const project = await readProjectFile(autosavePath());
    return loadResult(project, null);
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code)
        : null;

    if (code === "ENOENT") return null;
    throw error;
  }
}
