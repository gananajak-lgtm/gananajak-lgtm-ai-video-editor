import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { transcribeLongNarration } from "./ai/transcription";

type CacheRow = { signature: string; text: string };
type Cache = Record<string, CacheRow>;

function cachePath(verifiedAudioPath: string): string {
  // All verified voice MP3s are under <EP>/audio/dialogue.
  const dialogue = path.dirname(verifiedAudioPath);
  if (path.basename(dialogue) !== "dialogue") throw new Error("Invalid verified voice audio folder");
  return path.join(path.dirname(dialogue), "voice-asr-cache.json");
}
async function readCache(file: string): Promise<Cache> {
  try {
    const data: unknown = JSON.parse(await readFile(file, "utf8"));
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    return Object.fromEntries(Object.entries(data).filter(([id, value]) =>
      /^[a-f0-9]{64}$/.test(id) && value && typeof value === "object" &&
      typeof (value as CacheRow).signature === "string" &&
      typeof (value as CacheRow).text === "string")) as Cache;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}
export async function readOrTranscribeVerifiedVoice(verifiedAudioPath: string): Promise<string> {
  const info = await stat(verifiedAudioPath);
  if (!info.isFile() || info.size < 4) throw new Error("Missing or invalid saved voice MP3");
  const filename = cachePath(verifiedAudioPath);
  const key = createHash("sha256").update(path.basename(verifiedAudioPath)).digest("hex");
  const signature = String(info.size) + ":" + String(info.mtimeMs);
  const cache = await readCache(filename);
  if (cache[key]?.signature === signature && cache[key].text.trim()) return cache[key].text;
  // This is a PAID OpenAI transcription request. Call ONLY after direct user
  // confirmation at the UI, and ONLY for audio that metadata could not align.
  const result = await transcribeLongNarration(verifiedAudioPath);
  if (!result.text?.trim()) throw new Error("AI ไม่พบเสียงพูดที่ถอดข้อความได้จาก MP3");
  cache[key] = { signature, text: result.text.trim() };
  const temp = filename + "." + randomUUID() + ".tmp";
  await mkdir(path.dirname(filename), { recursive: true });
  try {
    await writeFile(temp, JSON.stringify(cache, null, 2), { flag: "wx" });
    await rename(temp, filename);
  } finally {
    const { rm } = await import("node:fs/promises");
    await rm(temp, { force: true }).catch(() => {});
  }
  return cache[key].text;
}
