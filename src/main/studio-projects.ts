import { app } from "electron";
import { mkdir, readFile, writeFile, rename, readdir, access, unlink } from "node:fs/promises";
import { readProjectFile, writeProject } from "./project-json";
import { assertStudioEpisodeIdentity } from "../shared/studio-episode-identity";
import { resolveBundledFfmpegPath } from "./studio-mp3-decode";
import type { ProjectDocument } from "../shared/types";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { hasPlausibleMp3Header } from "./studio-mp3-header";
import { isDecodableMp3 } from "./studio-mp3-decode";

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
  try {
    await writeFile(temp, JSON.stringify(projects, null, 2), { flag: "wx" });
    await rename(temp, indexPath());
  } catch (error) {
    await unlink(temp).catch(() => {});
    throw error;
  }
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

// Deleted projects/episodes are moved to a local recovery folder, never erased.
export async function deleteStudioProject(projectId: string): Promise<void> {
  const projects = await readIndex();
  const project = projects.find(item => item.id === projectId);
  if (!project) throw new Error("ไม่พบโปรเจกต์");
  const archive = path.join(root(), ".trash", "projects", randomUUID());
  await mkdir(path.dirname(archive), { recursive: true });
  await rename(path.join(root(), project.id), archive);
  try { await writeFile(path.join(archive, ".studio-deleted.json"), JSON.stringify({ kind: "project", project }), { flag: "wx" }); }
  catch (error) { await rename(archive, path.join(root(), project.id)); throw error; }
  try { await writeIndex(projects.filter(item => item.id !== projectId)); }
  catch (error) {
    await rename(archive, path.join(root(), project.id));
    await unlink(path.join(root(), project.id, ".studio-deleted.json"));
    throw error;
  }
}

export async function deleteStudioEpisode(projectId: string, episodeId: string): Promise<void> {
  const projects = await readIndex();
  const project = projects.find(item => item.id === projectId);
  const episode = project?.episodes.find(item => item.id === episodeId);
  if (!project || !episode) throw new Error("ไม่พบตอนที่ต้องการลบ");
  const original = path.join(root(), project.id, "episodes", episode.id);
  const archive = path.join(root(), ".trash", "episodes", randomUUID());
  await mkdir(path.dirname(archive), { recursive: true });
  await rename(original, archive);
  try { await writeFile(path.join(archive, ".studio-deleted.json"), JSON.stringify({ kind: "episode", projectId, episode, originalIndex: project.episodes.findIndex(item => item.id === episodeId) }), { flag: "wx" }); }
  catch (error) { await rename(archive, original); throw error; }
  project.episodes = project.episodes.filter(item => item.id !== episodeId);
  try { await writeIndex(projects); }
  catch (error) {
    await rename(archive, original);
    await unlink(path.join(original, ".studio-deleted.json"));
    throw error;
  }
}

function validArchivedId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
function validArchivedProject(value: unknown): value is StudioProject {
  if (!value || typeof value !== "object") return false;
  const project = value as StudioProject;
  return validArchivedId(project.id) && typeof project.title === "string" &&
    project.title.length > 0 && project.folder === path.join(root(), project.id) &&
    Array.isArray(project.episodes) && project.episodes.every(episode =>
      validArchivedId(episode.id) &&
      episode.folder === path.join(root(), project.id, "episodes", episode.id));
}
function validArchivedEpisode(value: unknown, projectId: unknown): value is StudioEpisode {
  if (!validArchivedId(projectId) || !value || typeof value !== "object") return false;
  const episode = value as StudioEpisode;
  return validArchivedId(episode.id) && typeof episode.title === "string" &&
    episode.title.length > 0 &&
    episode.folder === path.join(root(), projectId, "episodes", episode.id);
}
export type StudioTrashEntry = { archiveId: string; kind: "project" | "episode"; title: string; projectId: string; episodeId?: string };
export async function listStudioTrash(): Promise<StudioTrashEntry[]> {
  const result: StudioTrashEntry[] = [];
  for (const kind of ["projects", "episodes"] as const) {
    const directory = path.join(root(), ".trash", kind);
    let ids: string[];
    try { ids = await readdir(directory); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") continue; throw error; }
    for (const archiveId of ids) {
      if (!/^[0-9a-f-]{36}$/i.test(archiveId)) continue;
      try {
        const data = JSON.parse(await readFile(path.join(directory, archiveId, ".studio-deleted.json"), "utf8"));
        if (kind === "projects" && data.kind === "project" && validArchivedProject(data.project))
          result.push({ archiveId, kind: "project", title: data.project.title, projectId: data.project.id });
        if (kind === "episodes" && data.kind === "episode" && validArchivedEpisode(data.episode, data.projectId))
          result.push({ archiveId, kind: "episode", title: data.episode.title, projectId: data.projectId, episodeId: data.episode.id });
      } catch { /* Legacy trash without metadata cannot be safely restored by UI. */ }
    }
  }
  return result;
}
export async function restoreStudioTrash(kind: "project" | "episode", archiveId: string): Promise<void> {
  if ((kind !== "project" && kind !== "episode") || !/^[0-9a-f-]{36}$/i.test(archiveId)) throw new Error("Invalid trash entry");
  const archive = path.join(root(), ".trash", kind === "project" ? "projects" : "episodes", archiveId);
  const data = JSON.parse(await readFile(path.join(archive, ".studio-deleted.json"), "utf8"));
  const projects = await readIndex();
  if (kind === "project" && data.kind === "project") {
    const project = data.project as StudioProject;
    if (!validArchivedProject(project) || projects.some(item => item.id === project.id)) throw new Error("โปรเจกต์นี้มีอยู่แล้ว");
    const original = path.join(root(), project.id);
    try { await access(original); throw new Error("โฟลเดอร์โปรเจกต์มีอยู่แล้ว"); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    await rename(archive, original);
    try { await writeIndex([...projects, project]); }
    catch (error) { await rename(original, archive); throw error; }
    await unlink(path.join(original, ".studio-deleted.json")).catch(() => {});
  } else if (kind === "episode" && data.kind === "episode") {
    const project = projects.find(item => item.id === data.projectId);
    const episode = data.episode as StudioEpisode;
    if (!project || !validArchivedEpisode(episode, data.projectId) || project.episodes.some(item => item.id === episode.id)) throw new Error("ไม่พบโปรเจกต์ต้นทาง หรือ EP มีอยู่แล้ว");
    const original = path.join(root(), project.id, "episodes", episode.id);
    try { await access(original); throw new Error("โฟลเดอร์ EP มีอยู่แล้ว"); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    await mkdir(path.dirname(original), { recursive: true });
    await rename(archive, original);
    // New archives remember ordering; legacy archives still restore at the end.
    const originalIndex = Number.isInteger(data.originalIndex) && data.originalIndex >= 0
      ? Math.min(data.originalIndex, project.episodes.length)
      : project.episodes.length;
    project.episodes.splice(originalIndex, 0, episode);
    try { await writeIndex(projects); }
    catch (error) { await rename(original, archive); throw error; }
    await unlink(path.join(original, ".studio-deleted.json")).catch(() => {});
  } else throw new Error("Trash entry type mismatch");
}

// Episode editor documents are stored inside the existing episode directory, never
// in the global editor autosave. Resolve the path from the trusted Studio index.
async function episodeEditorPath(projectId: string, episodeId: string): Promise<string> {
  const project = (await readIndex()).find(item => item.id === projectId);
  const episode = project?.episodes.find(item => item.id === episodeId);
  if (!episode) throw new Error("Episode not found");
  return path.join(root(), project!.id, "episodes", episode.id, "timeline", "editor.aivproj");
}

export async function loadStudioEpisodeEditor(projectId: string, episodeId: string): Promise<ProjectDocument | null> {
  const filePath = await episodeEditorPath(projectId, episodeId);
  try { return await readProjectFile(filePath); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function saveStudioEpisodeEditor(projectId: string, episodeId: string, document: ProjectDocument): Promise<void> {
  // Never allow a document from another episode to overwrite this episode's file.
  assertStudioEpisodeIdentity(document.id, episodeId);
  if (document.id !== "episode-" + episodeId) {
    throw new Error("รหัสไทม์ไลน์ไม่ตรงกับ EP ที่กำลังบันทึก");
  }
  const filePath = await episodeEditorPath(projectId, episodeId);
  await writeProject(filePath, document);
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

/**
 * Resolve previously generated episode audio without trusting a path from
 * imported JSON. Only files inside this episode's audio directory qualify.
 * This never calls a paid voice API.
 */
export async function findReusableStudioEpisodeAudio(
  projectId: string,
  episodeId: string,
  relativePath: string
): Promise<string | null> {
  if (typeof relativePath !== "string" || !relativePath || path.isAbsolute(relativePath) ||
      relativePath.includes("\\") || relativePath.split("/").some(part => !part || part === "." || part === "..")) {
    return null;
  }
  const project = (await readIndex()).find(item => item.id === projectId);
  const episode = project?.episodes.find(item => item.id === episodeId);
  if (!episode) throw new Error("Episode not found");
  const audioRoot = path.resolve(episode.folder, "audio");
  const candidate = path.resolve(audioRoot, relativePath);
  if (!candidate.startsWith(audioRoot + path.sep) || path.extname(candidate).toLowerCase() !== ".mp3") return null;
  const { realpath, stat, open } = await import("node:fs/promises");
  try {
    const [realRoot, realFile, details] = await Promise.all([realpath(audioRoot), realpath(candidate), stat(candidate)]);
    if (!realFile.startsWith(realRoot + path.sep) || !details.isFile() || details.size < 4) return null;
    // Reject empty or obviously corrupt files; an extension alone is not proof of MP3 data.
    // Accept an ID3v2 header or a valid MPEG audio frame sync/header.
    const file = await open(realFile, "r");
    let header: Buffer;
    try {
      header = Buffer.alloc(10);
      const { bytesRead } = await file.read(header, 0, header.length, 0);
      if (bytesRead < 4) return null;
      if (!hasPlausibleMp3Header(header.subarray(0, bytesRead))) return null;
    } finally {
      await file.close();
    }
    if (!(await isDecodableMp3(realFile))) return null;
    return realFile;
  } catch (error) {
    if (["ENOENT", "ENOTDIR", "EACCES"].includes((error as NodeJS.ErrnoException).code ?? "")) return null;
    throw error;
  }
}

/** Probe a verified dialogue MP3 without making any provider request. */
export async function getStudioVoiceAudioDuration(
  projectId: string,
  episodeId: string,
  relativePath: string
): Promise<number> {
  const verifiedPath = await findReusableStudioEpisodeAudio(projectId, episodeId, relativePath);
  if (!verifiedPath) throw new Error("Dialogue MP3 is missing or invalid");
  const { spawn } = await import("node:child_process");
  const ffmpeg = (await import("ffmpeg-static")).default;
  if (typeof ffmpeg !== "string" || !ffmpeg) throw new Error("FFmpeg unavailable");
  const executable: string = resolveBundledFfmpegPath(ffmpeg);
  return new Promise<number>((resolve, reject) => {
    const child = spawn(executable, ["-hide_banner", "-nostdin", "-i", verifiedPath, "-f", "null", "-"], {
      stdio: ["ignore", "ignore", "pipe"], windowsHide: true
    });
    let output = "";
    let settled = false;
    const finish = (error?: Error, duration?: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve(duration!);
    };
    const timeout = setTimeout(() => { child.kill(); finish(new Error("MP3 duration probe timed out")); }, 30000);
    child.stderr.on("data", (chunk: Buffer) => { output = (output + chunk.toString()).slice(-32000); });
    child.on("error", (error: Error) => finish(error));
    child.on("close", (code: number | null) => {
      if (code !== 0) return finish(new Error("MP3 duration probe failed"));
      const matches = [...output.matchAll(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/g)];
      const last = matches[matches.length - 1];
      if (!last) return finish(new Error("MP3 duration unavailable"));
      const duration = Number(last[1]) * 3600 + Number(last[2]) * 60 + Number(last[3]);
      if (!Number.isFinite(duration) || duration <= 0) return finish(new Error("Invalid MP3 duration"));
      finish(undefined, duration);
    });
  });
}

export type StudioVoiceAudioEntry = {
  fingerprint: string;
  outputPath: string;
  jobId?: string;
  speaker?: string;
  emotion?: string;
  text?: string;
};

/** Ignore malformed optional metadata in old or externally edited manifests. */
function validVoiceMetadata(item: Partial<StudioVoiceAudioEntry>): Pick<StudioVoiceAudioEntry, "jobId" | "speaker" | "emotion" | "text"> {
  const result: Pick<StudioVoiceAudioEntry, "jobId" | "speaker" | "emotion" | "text"> = {};
  for (const [key, max] of [["jobId", 250], ["speaker", 200], ["emotion", 200], ["text", 10000]] as const) {
    const value = item[key];
    if (typeof value === "string" && value.trim() && value.length <= max) result[key] = value;
  }
  return result;
}

/** Read the per-episode audio manifest. Paths are relative to the episode audio folder. */
export async function loadStudioEpisodeVoiceAudio(
  projectId: string,
  episodeId: string
): Promise<Record<string, StudioVoiceAudioEntry>> {
  const project = (await readIndex()).find(item => item.id === projectId);
  const episode = project?.episodes.find(item => item.id === episodeId);
  if (!episode) throw new Error("Episode not found");
  const manifest = path.join(episode.folder, "audio", "voice-manifest.json");
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(manifest, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid audio manifest");
  const entries = Object.entries(parsed);
  if (entries.length > 10000) throw new Error("Audio manifest too large");
  const result: Record<string, StudioVoiceAudioEntry> = Object.create(null);
  for (const [lineId, value] of entries) {
    if (!lineId || lineId.length > 250 || !value || typeof value !== "object" || Array.isArray(value)) continue;
    const item = value as Partial<StudioVoiceAudioEntry>;
    if (typeof item.fingerprint !== "string" || item.fingerprint.length > 10000 ||
        typeof item.outputPath !== "string" || item.outputPath.length > 500) continue;
    if (await findReusableStudioEpisodeAudio(projectId, episodeId, item.outputPath)) {
      result[lineId] = { fingerprint: item.fingerprint, outputPath: item.outputPath, ...validVoiceMetadata(item) };
    }
  }
  return result;
}

/**
 * Save verified audio metadata atomically; a missing or external MP3 is never
 * accepted as a reusable asset. Does not generate audio or spend credits.
 */
export async function saveStudioEpisodeVoiceAudio(
  projectId: string,
  episodeId: string,
  entries: Record<string, StudioVoiceAudioEntry>
): Promise<void> {
  if (!entries || typeof entries !== "object" || Array.isArray(entries) || Object.keys(entries).length > 10000) {
    throw new Error("Invalid audio manifest");
  }
  const project = (await readIndex()).find(item => item.id === projectId);
  const episode = project?.episodes.find(item => item.id === episodeId);
  if (!episode) throw new Error("Episode not found");
  for (const [lineId, item] of Object.entries(entries)) {
    if (!lineId || lineId.length > 250 || !item || typeof item.fingerprint !== "string" ||
        item.fingerprint.length > 10000 || typeof item.outputPath !== "string" ||
        item.outputPath.length > 500 || !(await findReusableStudioEpisodeAudio(projectId, episodeId, item.outputPath))) {
      throw new Error("Audio manifest contains missing or invalid MP3");
    }
  }
  const directory = path.join(episode.folder, "audio");
  await mkdir(directory, { recursive: true });
  const temp = path.join(directory, "voice-manifest-" + randomUUID() + ".tmp");
  await writeFile(temp, JSON.stringify(entries, null, 2), { flag: "wx" });
  const { rename } = await import("node:fs/promises");
  await rename(temp, path.join(directory, "voice-manifest.json"));
}

/**
 * Resolve a safe destination for a generated dialogue MP3 inside the selected
 * episode. This only calculates a path; it never creates audio or calls an API.
 */
export async function resolveStudioEpisodeVoiceOutput(
  projectId: string,
  episodeId: string,
  lineId: string
): Promise<{ absolutePath: string; relativePath: string }> {
  if (typeof lineId !== "string" || !/^[a-zA-Z0-9_-]{1,120}$/.test(lineId)) {
    throw new Error("Invalid voice line ID");
  }
  const project = (await readIndex()).find(item => item.id === projectId);
  const episode = project?.episodes.find(item => item.id === episodeId);
  if (!episode) throw new Error("Episode not found");
  const relativePath = `dialogue/${lineId}.mp3`;
  const audioRoot = path.resolve(episode.folder, "audio");
  const absolutePath = path.resolve(audioRoot, relativePath);
  if (!absolutePath.startsWith(audioRoot + path.sep)) throw new Error("Unsafe voice output path");
  await mkdir(path.dirname(absolutePath), { recursive: true });
  return { absolutePath, relativePath };
}

/**
 * Register a newly synthesized and verified MP3 without discarding other lines.
 * The caller must finish writing and validating the MP3 before invoking this.
 */
const voiceManifestQueues = new Map<string, Promise<void>>();
/** Remove one generated line from the active manifest without deleting its MP3.
 * Serializes with registrations so an in-flight synthesis cannot overwrite
 * the updated manifest through a stale read.
 */
export async function removeStudioEpisodeVoiceAudio(projectId: string, episodeId: string, lineId: string): Promise<void> {
  if (typeof lineId !== "string" || !lineId.trim() || lineId.length > 250) throw new Error("Invalid voice line ID");
  const key = `${projectId}:${episodeId}`;
  const previous = voiceManifestQueues.get(key) ?? Promise.resolve();
  const pending = previous.catch(() => {}).then(async () => {
    const existing = await loadStudioEpisodeVoiceAudio(projectId, episodeId);
    if (!Object.prototype.hasOwnProperty.call(existing, lineId)) throw new Error("ไม่พบเสียงบรรทัดนี้");
    delete existing[lineId];
    await saveStudioEpisodeVoiceAudio(projectId, episodeId, existing);
  });
  voiceManifestQueues.set(key, pending);
  try { await pending; }
  finally { if (voiceManifestQueues.get(key) === pending) voiceManifestQueues.delete(key); }
}

export async function registerStudioEpisodeVoiceAudio(
  projectId: string,
  episodeId: string,
  lineId: string,
  fingerprint: string,
  relativePath: string,
  metadata: Pick<StudioVoiceAudioEntry, "jobId" | "speaker" | "emotion" | "text"> = {}
): Promise<void> {
  if (typeof lineId !== "string" || !lineId.trim() || lineId.length > 250 ||
      typeof fingerprint !== "string" || !fingerprint || fingerprint.length > 10000) {
    throw new Error("Invalid voice audio entry");
  }
  const key = `${projectId}:${episodeId}`;
  const previous = voiceManifestQueues.get(key) ?? Promise.resolve();
  const pending = previous.catch(() => {}).then(async () => {
    if (!(await findReusableStudioEpisodeAudio(projectId, episodeId, relativePath))) {
      throw new Error("Generated MP3 must exist and decode before registration");
    }
    const existing = await loadStudioEpisodeVoiceAudio(projectId, episodeId);
    await saveStudioEpisodeVoiceAudio(projectId, episodeId, {
      ...existing,
      [lineId]: { fingerprint, outputPath: relativePath, ...validVoiceMetadata(metadata) }
    });
  });
  voiceManifestQueues.set(key, pending);
  try { await pending; }
  finally { if (voiceManifestQueues.get(key) === pending) voiceManifestQueues.delete(key); }
}

/**
 * Read-only bridge for MyCut interchange. Only already validated MP3 files are included.
 * Missing audio is never regenerated automatically (no ElevenLabs calls or credit use).
 */
export async function prepareStudioEpisodeMyCutVoiceManifest(projectId: string, episodeId: string) {
  const project = (await readIndex()).find(item => item.id === projectId);
  const episode = project?.episodes.find(item => item.id === episodeId);
  if (!project || !episode) throw new Error("Episode not found");
  const entries = await loadStudioEpisodeVoiceAudio(projectId, episodeId);
  const lines: Array<{ lineId: string; audio: string; duration: number; speaker: string; text: string }> = [];
  for (const [lineId, entry] of Object.entries(entries)) {
    const audio = await findReusableStudioEpisodeAudio(projectId, episodeId, entry.outputPath);
    if (!audio) continue;
    const duration = await getStudioVoiceAudioDuration(projectId, episodeId, entry.outputPath);
    if (!Number.isFinite(duration) || duration <= 0) continue;
    lines.push({ lineId, audio, duration, speaker: entry.speaker ?? "ผู้บรรยาย", text: entry.text ?? "" });
  }
  // Preserve declared generation order if available; never sort by a random line UUID.
  lines.sort((a, b) => {
    const aOrder = Number(a.lineId.match(/(?:^|[-_])line[-_](\\d+)$/i)?.[1]);
    const bOrder = Number(b.lineId.match(/(?:^|[-_])line[-_](\\d+)$/i)?.[1]);
    return Number.isFinite(aOrder) && Number.isFinite(bOrder) ? aOrder - bOrder : 0;
  });
  return {
    title: `${project.title} — ${episode.title}`,
    width: 1080,
    height: 1920,
    fps: 30,
    gapSeconds: 0.3,
    lines,
    visuals: [],
    note: "Only existing verified MP3 assets. Add frames before export to avoid blank video."
  };
}

/** Conservative Thai/English filename ↔ narration matching, not visual AI. */
export function suggestMyCutImageOrder(
  images: string[],
  narration: Array<{ text: string }>,
  descriptions: Record<string, string> = {}
): Array<{ image: string; lineIndex: number; score: number; matched: boolean }> {
  // Optional sidecar captions are read locally; never sent to an external provider.\n  // Conservative heuristic: require two distinct words in both filename and dialogue.
  // Unmatched/ambiguous pictures retain their original slots and order.
  const tokens = (value: string) => new Set(
    value.toLowerCase().normalize("NFKC")
      .replace(/[._-]+/g, " ")
      .match(/[\p{L}\p{N}]+/gu)?.filter(word => word.length >= 2) ?? []
  );
  const lines = narration.map(line => tokens(line.text || ""));
  const proposals = images.map((image, originalIndex) => {
    const caption = descriptions[image] || "";
    const explicit = caption.match(/(?:^|\n)\s*(?:line|บรรทัด)\s*[:：=]\s*(\d+)\s*(?:\n|$)/i);
    const specified = explicit ? Number(explicit[1]) - 1 : -1;
    if (Number.isInteger(specified) && specified >= 0 && specified < narration.length) {
      return { image, lineIndex: specified, score: 100, matched: true, originalIndex };
    }
    const words = tokens(caption + " " + path.parse(image).name);
    const scores = lines.map(wordsInLine => [...words].filter(word => wordsInLine.has(word)).length);
    const high = Math.max(0, ...scores);
    const winners = scores.reduce<number[]>((list, score, index) => {
      if (score === high && high >= 2) list.push(index);
      return list;
    }, []);
    const matched = winners.length === 1;
    return { image, lineIndex: matched ? winners[0] : originalIndex, score: high, matched, originalIndex };
  });
  const matchedSlots = proposals.map((item, index) => item.matched ? index : -1).filter(index => index >= 0);
  const orderedMatches = proposals.filter(item => item.matched)
    .sort((a, b) => a.lineIndex - b.lineIndex || a.originalIndex - b.originalIndex);
  const result = proposals.slice();
  matchedSlots.forEach((slot, i) => { result[slot] = orderedMatches[i]; });
  return result.map(({ image, lineIndex, score, matched }) => ({ image, lineIndex, score, matched }));
}

/** Write a new MyCut project directly from existing MP3 assets; never generate paid audio. */
export async function exportStudioEpisodeToMyCut(
  projectId: string, episodeId: string, orderedLineIds: string[], destination: string, imagePaths: string[] = []
): Promise<{ path: string; audioClips: number; duration: number }> {
  if (!Array.isArray(orderedLineIds) || orderedLineIds.length > 10000 ||
      orderedLineIds.some(value => typeof value !== "string" || !value || value.length > 250) ||
      new Set(orderedLineIds).size !== orderedLineIds.length) throw new Error("Invalid MyCut line order");
  if (path.extname(destination).toLowerCase() !== ".mycut") throw new Error("Output must be .mycut");
  const manifest = await prepareStudioEpisodeMyCutVoiceManifest(projectId, episodeId);
  const byId = new Map(manifest.lines.map(line => [line.lineId, line]));
  const selected = orderedLineIds.length ? orderedLineIds.map(id => {
    const line = byId.get(id);
    if (!line) throw new Error("MP3 unavailable for selected line: " + id);
    return line;
  }) : manifest.lines;
  if (!selected.length) throw new Error("No verified MP3 files for this episode");
  const media: Array<Record<string, unknown>> = [];
  const clips: Array<Record<string, unknown>> = [];
  const defaults = {
    speed: 1, volume: 1, opacity: 1, bright: 0, contrast: 1, sat: 1, sepia: 0,
    hue: 0, fadeIn: 0, fadeOut: 0, scale: 1, px: 0, py: 0, filter: "none",
    chroma: false, chromaColor: "#00b140", chromaSim: 0.15, chromaBlend: 0.08,
    rot: 0, cropL: 0, cropR: 0, cropT: 0, cropB: 0
  };
  let cursor = 0;
  const lineStarts: number[] = [];
  selected.forEach((line, index) => {
    lineStarts.push(cursor);
    const mediaId = "m-" + randomUUID();
    media.push({ id: mediaId, path: line.audio, name: path.basename(line.audio),
      kind: "audio", dur: 0, w: 0, h: 0, hasAudio: false });
    clips.push({ ...defaults, id: "c-" + randomUUID(), kind: "audio",
      mediaId, path: line.audio, name: `${line.speaker} · ${index + 1}`,
      w: 0, h: 0, hasAudio: true, srcDur: line.duration,
      track: "A1", start: cursor, in: 0, dur: line.duration, thumb: null });
    cursor += line.duration + (index === selected.length - 1 ? 0 : 0.3);
  });
  // Fill V1 for the entire voice timeline, including the 0.3-second speech pauses.
  // The user selects images explicitly; no scene matching or paid AI call occurs here.
  if (!Array.isArray(imagePaths) || imagePaths.length > 500 ||
      imagePaths.some(file => typeof file !== "string" || !file ||
        ![".png", ".jpg", ".jpeg", ".webp", ".bmp"].includes(path.extname(file).toLowerCase()))) {
    throw new Error("Invalid image selection");
  }
  const { stat } = await import("node:fs/promises");
  for (const file of imagePaths) {
    if (!(await stat(file)).isFile()) throw new Error("Image not found: " + path.basename(file));
  }
  if (imagePaths.length > 0) {
    // Distribute images across spoken lines, and place cuts on their boundaries.
    // If there are more images than lines, subdivide within each allocated line.
    // The next image always begins where the previous ends: V1 never has pauses.
    const lineCount = selected.length;
    const imageCount = imagePaths.length;
    // Explicit sidecar cues ("line: 3" / "บรรทัด: 3") control *time*, not only image order.
    // Missing cues keep voice-boundary distribution. Invalid / non-monotonic cues
    // are ignored to avoid negative-duration or overlapping V1 clips.
    const { readFile: readSidecar } = await import("node:fs/promises");
    const cues: Array<number | null> = [];
    for (const image of imagePaths) {
      try {
        const sidecar = image + ".txt";
        if ((await stat(sidecar)).size > 8192) { cues.push(null); continue; }
        const caption = await readSidecar(sidecar, "utf8");
        const match = caption.match(/(?:^|\n)\s*(?:line|บรรทัด)\s*[:：=]\s*(\d+)\s*(?:\n|$)/i);
        const line = match ? Number(match[1]) - 1 : -1;
        cues.push(Number.isInteger(line) && line >= 0 && line < lineCount ? line : null);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        cues.push(null);
      }
    }
    const cuts: number[] = [0];
    for (let index = 1; index < imageCount; index++) {
      const scaled = imageCount <= lineCount
        ? Math.ceil(index * lineCount / imageCount)
        : index * lineCount / imageCount;
      const lineIndex = Math.floor(scaled);
      const fraction = scaled - lineIndex;
      const start = lineStarts[lineIndex];
      const end = lineIndex + 1 < lineCount ? lineStarts[lineIndex + 1] : cursor;
      const proposal = start + (end - start) * fraction;
      const cue = cues[index];
      const pinned = cue === null ? proposal : lineStarts[cue];
      // Never allow a cue to cross the previous image or leave no time
      // for the remaining images.
      const safe = pinned > cuts[index - 1] && pinned < cursor ? pinned : proposal;
      cuts.push(Math.max(cuts[index - 1], Math.min(cursor, safe)));
    }
    cuts.push(cursor);
    imagePaths.forEach((file, index) => {
      const start = cuts[index];
      const end = cuts[index + 1];
      const mediaId = "m-" + randomUUID();
      media.push({ id: mediaId, path: file, name: path.basename(file),
        kind: "image", dur: 0, w: 1080, h: 1920, hasAudio: false });
      clips.push({ ...defaults, id: "c-" + randomUUID(), kind: "image",
        mediaId, path: file, name: path.basename(file),
        w: 1080, h: 1920, hasAudio: false, srcDur: end - start,
        track: "V1", start, in: 0, dur: end - start, thumb: null });
    });
  }
  const project = {
    id: "p-" + randomUUID(), name: manifest.title,
    created: Date.now(), updated: Date.now(),
    w: 1080, h: 1920, fps: 30, media, clips,
    magnet: true, snap: true, dur: cursor, thumb: null,
    tracks: [
      { id: "V1", type: "video", main: true, hide: false, mute: false, lock: false },
      { id: "A1", type: "audio", main: false, hide: false, mute: false, lock: false }
    ]
  };
  // Exclusive creation: never overwrite an existing user's MyCut edit.
  await writeFile(destination, JSON.stringify(project, null, 2), { flag: "wx" });
  return { path: destination, audioClips: selected.length, duration: cursor };
}
