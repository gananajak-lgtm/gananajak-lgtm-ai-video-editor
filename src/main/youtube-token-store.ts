import { app, safeStorage } from "electron";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { YouTubeTokenResponse } from "./youtube-oauth";

export type StoredYouTubeTokens=YouTubeTokenResponse & { obtainedAt:number; expiresAt:number };

const tokenPath=()=>path.join(app.getPath("userData"),"publish","youtube-token.bin");
const configPath=()=>path.join(app.getPath("userData"),"publish","youtube-oauth-config.bin");

export async function saveYouTubeTokens(tokens:YouTubeTokenResponse) {
  const now=Date.now();
  const stored:StoredYouTubeTokens={...tokens,obtainedAt:now,expiresAt:now+Math.max(0,tokens.expires_in-60)*1000};
  if (!safeStorage.isEncryptionAvailable()) throw new Error("Secure token storage is not available on this system.");
  const encrypted=safeStorage.encryptString(JSON.stringify(stored));
  await mkdir(path.dirname(tokenPath()),{recursive:true});
  await writeFile(tokenPath(),encrypted);
}

export async function saveYouTubeOAuthConfig(config:{clientId:string;clientSecret?:string}) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error("Secure OAuth configuration storage is not available on this system.");
  await mkdir(path.dirname(configPath()),{recursive:true});
  await writeFile(configPath(),safeStorage.encryptString(JSON.stringify(config)));
}

export async function loadYouTubeOAuthConfig():Promise<{clientId:string;clientSecret?:string}|null> {
  try { if(!safeStorage.isEncryptionAvailable()) return null; return JSON.parse(safeStorage.decryptString(await readFile(configPath()))); } catch { return null; }
}

export async function loadYouTubeTokens():Promise<StoredYouTubeTokens|null> {
  try {
    if (!safeStorage.isEncryptionAvailable()) return null;
    const encrypted=await readFile(tokenPath());
    return JSON.parse(safeStorage.decryptString(encrypted)) as StoredYouTubeTokens;
  } catch { return null; }
}
