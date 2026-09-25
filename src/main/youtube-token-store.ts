import { app, safeStorage } from "electron";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { YouTubeTokenResponse } from "./youtube-oauth";

const tokenPath=()=>path.join(app.getPath("userData"),"publish","youtube-token.bin");

export async function saveYouTubeTokens(tokens:YouTubeTokenResponse) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error("Secure token storage is not available on this system.");
  const encrypted=safeStorage.encryptString(JSON.stringify(tokens));
  await mkdir(path.dirname(tokenPath()),{recursive:true});
  await writeFile(tokenPath(),encrypted);
}

export async function loadYouTubeTokens():Promise<YouTubeTokenResponse|null> {
  try {
    if (!safeStorage.isEncryptionAvailable()) return null;
    const encrypted=await readFile(tokenPath());
    return JSON.parse(safeStorage.decryptString(encrypted)) as YouTubeTokenResponse;
  } catch { return null; }
}
