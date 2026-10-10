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
