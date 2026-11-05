import { createHash, randomUUID } from "node:crypto";
import { readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";

type MediaLine = { lineId: string; audio: string; duration: number };
const validProjectId = (id: string): boolean => /^p-[a-f0-9-]{36}$/i.test(id);

export async function fingerprintMyCutEpisodeImport(
  projectId: string, episodeId: string, lineIds: string[], images: string[],
  lines: MediaLine[], formatVersion = "legacy"
): Promise<string> {
  const byId = new Map(lines.map(line => [line.lineId, line]));
  const ordered = lineIds.length ? lineIds.map(id => {
    const line = byId.get(id);
    if (!line) throw new Error("Missing verified MP3 for line: " + id);
    return line;
  }) : lines;
  if (!ordered.length || new Set(ordered.map(line => line.lineId)).size !== ordered.length)
    throw new Error("No valid MP3 sequence for MyCut");
  const files = await Promise.all(
    [...ordered.map(line => line.audio), ...images].map(async file => {
      const item = await stat(file);
      if (!item.isFile() || item.size <= 0) throw new Error("Media unavailable: " + path.basename(file));
      return [path.resolve(file), item.size, item.mtimeMs];
    })
  );
  const payload = [formatVersion, projectId, episodeId, ordered.map(x => [x.lineId, x.duration]), files];
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export async function lookupMyCutEpisodeImport(folder: string, fingerprint: string): Promise<string | null> {
  if (!/^[a-f0-9]{64}$/.test(fingerprint)) return null;
  try {
    const data: unknown = JSON.parse(await readFile(path.join(folder, "import-index.json"), "utf8"));
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    const id = (data as Record<string, unknown>)[fingerprint];
    if (typeof id !== "string" || !validProjectId(id)) return null;
    const target = await stat(path.join(folder, "projects", id + ".json"));
    return target.isFile() && target.size > 0 ? id : null;
  } catch { return null; }
}

export async function rememberMyCutEpisodeImport(folder: string, fingerprint: string, id: string): Promise<void> {
  if (!/^[a-f0-9]{64}$/.test(fingerprint) || !validProjectId(id)) throw new Error("Invalid MyCut import index");
  const filename = path.join(folder, "import-index.json");
  let records: Record<string, string> = {};
  try {
    const parsed: unknown = JSON.parse(await readFile(filename, "utf8"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      records = Object.fromEntries(Object.entries(parsed)
        .filter(([k, v]) => /^[a-f0-9]{64}$/.test(k) && typeof v === "string" && validProjectId(v))
        .slice(-499));
    }
  } catch { /* First import or invalid old index: preserve project files and create a new index. */ }
  records[fingerprint] = id;
  const temp = path.join(folder, ".import-index-" + randomUUID() + ".tmp");
  try {
    await writeFile(temp, JSON.stringify(records), { flag: "wx" });
    await rename(temp, filename);
  } catch (error) {
    const { rm } = await import("node:fs/promises");
    await rm(temp, { force: true }).catch(() => {});
    throw error;
  }
}
