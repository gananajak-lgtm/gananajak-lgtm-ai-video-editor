import { app, dialog } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import type {
  MediaRelink,
  ProjectDocument,
  ProjectLoadResult,
  ProjectRelinkResult,
  ProjectSaveResult
} from "../shared/types";

const AUTOSAVE_FILE = "autosave.aivproj";
const SCHEMA_VERSION = 1;
const MAX_RELINK_SCAN_FILES = 50_000;

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

  if (project.timeline?.narration) paths.add(project.timeline.narration);
  for (const clip of project.timeline?.clips ?? []) {
    paths.add(clip.imagePath);
  }

  for (const layer of project.editingPlan?.automaticAudioLayers ?? []) {
    paths.add(layer.filePath);
  }

  for (const cue of project.editingPlan?.sfxCues ?? []) {
    if (cue.matchedFilePath) paths.add(cue.matchedFilePath);
  }

  return [...paths];
}

export async function findMissingMedia(project: ProjectDocument) {
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

function replacePath(value: string | null, from: string, to: string) {
  return value === from ? to : value;
}

function applyMediaRelink(
  project: ProjectDocument,
  relink: MediaRelink
): ProjectDocument {
  const { from, to } = relink;

  return {
    ...project,
    updatedAt: new Date().toISOString(),
    images: project.images.map((value) =>
      value === from ? to : value
    ),
    narration: replacePath(project.narration, from, to),
    audioLayers: project.audioLayers.map((layer) => ({
      ...layer,
      filePath: layer.filePath === from ? to : layer.filePath
    })),
    editingPlan: project.editingPlan
      ? {
          ...project.editingPlan,
          automaticAudioLayers:
            project.editingPlan.automaticAudioLayers.map((layer) => ({
              ...layer,
              filePath: layer.filePath === from ? to : layer.filePath
            })),
          sfxCues: project.editingPlan.sfxCues.map((cue) => ({
            ...cue,
            matchedFilePath:
              cue.matchedFilePath === from ? to : cue.matchedFilePath
          }))
        }
      : null,
    timeline: project.timeline
      ? {
          ...project.timeline,
          narration:
            project.timeline.narration === from
              ? to
              : project.timeline.narration,
          clips: project.timeline.clips.map((clip) => ({
            ...clip,
            imagePath: clip.imagePath === from ? to : clip.imagePath
          })),
          audioLayers: project.timeline.audioLayers.map((layer) => ({
            ...layer,
            filePath: layer.filePath === from ? to : layer.filePath
          }))
        }
      : null
  };
}

function applyMediaRelinks(
  project: ProjectDocument,
  relinks: MediaRelink[]
) {
  return relinks.reduce(applyMediaRelink, project);
}

async function relinkResult(
  project: ProjectDocument,
  relinked: MediaRelink[]
): Promise<ProjectRelinkResult> {
  return {
    project,
    relinked,
    missingMedia: await findMissingMedia(project)
  };
}

function filterForPath(filePath: string) {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const imageExtensions = ["png", "jpg", "jpeg", "webp"];
  const audioExtensions = ["mp3", "wav", "m4a", "aac", "flac", "ogg"];

  if (imageExtensions.includes(ext)) {
    return [{ name: "Images", extensions: imageExtensions }];
  }

  if (audioExtensions.includes(ext)) {
    return [{ name: "Audio", extensions: audioExtensions }];
  }

  return [{ name: "Media", extensions: [ext || "*"] }];
}

async function scanFolder(root: string) {
  const byBaseName = new Map<string, string[]>();
  const queue = [root];
  let scannedFiles = 0;

  while (queue.length > 0 && scannedFiles < MAX_RELINK_SCAN_FILES) {
    const directory = queue.shift();
    if (!directory) break;

    let entries;
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        if (!entry.name.startsWith(".")) queue.push(fullPath);
        continue;
      }

      if (!entry.isFile()) continue;

      scannedFiles += 1;
      const key = entry.name.toLocaleLowerCase();
      const matches = byBaseName.get(key) ?? [];
      matches.push(fullPath);
      byBaseName.set(key, matches);

      if (scannedFiles >= MAX_RELINK_SCAN_FILES) break;
    }
  }

  return byBaseName;
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

export async function relinkSingleMedia(
  project: ProjectDocument,
  missingPath: string
): Promise<ProjectRelinkResult | null> {
  const result = await dialog.showOpenDialog({
    title: `Relink ${path.basename(missingPath)}`,
    properties: ["openFile"],
    filters: filterForPath(missingPath)
  });

  if (result.canceled || !result.filePaths[0]) return null;

  const relink = {
    from: missingPath,
    to: result.filePaths[0]
  };
  const updated = applyMediaRelink(project, relink);
  return relinkResult(updated, [relink]);
}

export async function relinkMissingMediaFromFolder(
  project: ProjectDocument,
  missingMedia: string[]
): Promise<ProjectRelinkResult | null> {
  if (!missingMedia.length) {
    return relinkResult(project, []);
  }

  const result = await dialog.showOpenDialog({
    title: "Find moved media in folder",
    properties: ["openDirectory"]
  });

  if (result.canceled || !result.filePaths[0]) return null;

  const byBaseName = await scanFolder(result.filePaths[0]);
  const relinks: MediaRelink[] = [];

  for (const missingPath of missingMedia) {
    const matches =
      byBaseName.get(path.basename(missingPath).toLocaleLowerCase()) ?? [];

    if (matches.length === 1) {
      relinks.push({
        from: missingPath,
        to: matches[0]
      });
    }
  }

  const updated = applyMediaRelinks(project, relinks);
  return relinkResult(updated, relinks);
}
