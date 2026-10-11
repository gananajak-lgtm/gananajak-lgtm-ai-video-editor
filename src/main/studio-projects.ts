import { app } from "electron";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type StudioEpisode = { id: string; title: string; folder: string; createdAt: string };
export type StudioProject = { id: string; title: string; folder: string; createdAt: string; episodes: StudioEpisode[] };
const root = () => path.join(app.getPath("userData"), "studio-projects");
const indexPath = () => path.join(root(), "projects.json");
async function readIndex(): Promise<StudioProject[]> {
  try {
    const value: unknown = JSON.parse(await readFile(indexPath(), "utf8"));
    return Array.isArray(value) ? value as StudioProject[] : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}
async function writeIndex(projects: StudioProject[]) {
  await mkdir(root(), { recursive: true });
  const temp = path.join(root(), `projects-${randomUUID()}.tmp`);
  await writeFile(temp, JSON.stringify(projects, null, 2), { flag: "wx" });
  const { rename } = await import("node:fs/promises");
  await rename(temp, indexPath());
}
function requireTitle(title: string) {
  const value = title.trim();
  if (!value || value.length > 120) throw new Error("ชื่อโปรเจกต์หรือตอนต้องมี 1–120 ตัวอักษร");
  return value;
}
export async function listStudioProjects() { return readIndex(); }
export async function createStudioProject(title: string) {
  const id = randomUUID();
  const folder = path.join(root(), id);
  const project: StudioProject = { id, title: requireTitle(title), folder, createdAt: new Date().toISOString(), episodes: [] };
  await mkdir(path.join(folder, "characters"), { recursive: true });
  await writeFile(path.join(folder, "characters", "voice-library.json"), "{}", { flag: "wx" });
  await writeIndex([...(await readIndex()), project]);
  return project;
}
export async function createStudioEpisode(projectId: string, title: string) {
  const projects = await readIndex();
  const project = projects.find(item => item.id === projectId);
  if (!project) throw new Error("ไม่พบโปรเจกต์");
  const id = randomUUID();
  const folder = path.join(project.folder, "episodes", id);
  const episode: StudioEpisode = { id, title: requireTitle(title), folder, createdAt: new Date().toISOString() };
  for (const sub of ["script", "audio/narration", "audio/dialogue", "audio/sfx", "images", "videos", "timeline", "exports"]) {
    await mkdir(path.join(folder, sub), { recursive: true });
  }
  project.episodes.push(episode);
  await writeIndex(projects);
  return episode;
}

export async function loadStudioEpisodeScript(projectId: string, episodeId: string): Promise<string> {
  const project = (await readIndex()).find(item => item.id === projectId);
  const episode = project?.episodes.find(item => item.id === episodeId);
  if (!episode) throw new Error("Episode not found");
  try {
    return await readFile(path.join(episode.folder, "script", "source.txt"), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw error;
  }
}

export async function saveStudioEpisodeScript(projectId: string, episodeId: string, script: string): Promise<void> {
  if (typeof script !== "string" || script.length > 2000000) throw new Error("Script exceeds the maximum length");
  const project = (await readIndex()).find(item => item.id === projectId);
  const episode = project?.episodes.find(item => item.id === episodeId);
  if (!episode) throw new Error("Episode not found");
  const directory = path.join(episode.folder, "script");
  await mkdir(directory, { recursive: true });
  const temp = path.join(directory, "source-" + randomUUID() + ".tmp");
  await writeFile(temp, script, { flag: "wx" });
  const { rename } = await import("node:fs/promises");
  await rename(temp, path.join(directory, "source.txt"));
}

export async function loadStudioCharacterVoices(projectId: string): Promise<Record<string, string>> {
  const project = (await readIndex()).find(item => item.id === projectId);
  if (!project) throw new Error("Project not found");
  const file = path.join(project.folder, "characters", "voice-library.json");
  try {
    const value: unknown = JSON.parse(await readFile(file, "utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid character voice library");
    return Object.fromEntries(Object.entries(value).filter(([name, id]) =>
      name.trim().length > 0 && name.length <= 150 && typeof id === "string" && id.length <= 250
    )) as Record<string, string>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}

// Serialize writes per project so overlapping saves cannot rename files out of order.
const voiceWriteQueues = new Map<string, Promise<void>>();

export async function saveStudioCharacterVoices(projectId: string, voices: Record<string, string>): Promise<void> {
  const previous = voiceWriteQueues.get(projectId) ?? Promise.resolve();
  const pending = previous.catch(() => {}).then(() => writeStudioCharacterVoices(projectId, voices));
  voiceWriteQueues.set(projectId, pending);
  try { await pending; }
  finally { if (voiceWriteQueues.get(projectId) === pending) voiceWriteQueues.delete(projectId); }
}

// Apply a single-character change inside the same per-project write queue.
// This avoids lost updates when different screens edit different characters.
export async function patchStudioCharacterVoice(projectId: string, character: string, voiceId: string | null): Promise<Record<string, string>> {
  if (typeof character !== "string" || !character.trim() || character.length > 150 ||
      (voiceId !== null && (typeof voiceId !== "string" || voiceId.length > 250))) {
    throw new Error("Invalid character voice entry");
  }
  const previous = voiceWriteQueues.get(projectId) ?? Promise.resolve();
  let updated: Record<string, string> = {};
  const pending = previous.catch(() => {}).then(async () => {
    const latest = await loadStudioCharacterVoices(projectId);
    updated = { ...latest };
    if (voiceId === null) delete updated[character];
    else updated[character] = voiceId;
    await writeStudioCharacterVoices(projectId, updated);
  });
  voiceWriteQueues.set(projectId, pending);
  try {
    await pending;
    return updated;
  } finally {
    if (voiceWriteQueues.get(projectId) === pending) voiceWriteQueues.delete(projectId);
  }
}

async function writeStudioCharacterVoices(projectId: string, voices: Record<string, string>): Promise<void> {
  if (!voices || typeof voices !== "object" || Array.isArray(voices)) throw new Error("Invalid character voice library");
  const entries = Object.entries(voices);
  if (entries.length > 1000 || entries.some(([name, id]) =>
    !name.trim() || name.length > 150 || typeof id !== "string" || id.length > 250
  )) throw new Error("Invalid character voice entry");
  const project = (await readIndex()).find(item => item.id === projectId);
  if (!project) throw new Error("Project not found");
  const directory = path.join(project.folder, "characters");
  await mkdir(directory, { recursive: true });
  const temp = path.join(directory, "voice-library-" + randomUUID() + ".tmp");
  await writeFile(temp, JSON.stringify(voices, null, 2), { flag: "wx" });
  const { rename } = await import("node:fs/promises");
  await rename(temp, path.join(directory, "voice-library.json"));
}
