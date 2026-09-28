import { app, safeStorage } from "electron";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { TikTokTokenResponse } from "./tiktok-oauth";

export type StoredTikTokTokens=TikTokTokenResponse & { obtainedAt:number; expiresAt:number; refreshExpiresAt:number };
export type TikTokOAuthConfig={clientKey:string;clientSecret:string};

const tokenPath=()=>path.join(app.getPath("userData"),"publish","tiktok-token.bin");
const configPath=()=>path.join(app.getPath("userData"),"publish","tiktok-oauth-config.bin");

async function saveEncrypted(filePath:string,value:unknown,errorMessage:string) {
  if(!safeStorage.isEncryptionAvailable()) throw new Error(errorMessage);
  await mkdir(path.dirname(filePath),{recursive:true});
  await writeFile(filePath,safeStorage.encryptString(JSON.stringify(value)));
}
async function loadEncrypted<T>(filePath:string):Promise<T|null> {
  try { if(!safeStorage.isEncryptionAvailable()) return null; return JSON.parse(safeStorage.decryptString(await readFile(filePath))) as T; } catch { return null; }
}

export async function saveTikTokTokens(tokens:TikTokTokenResponse) {
  const now=Date.now();
  await saveEncrypted(tokenPath(),{...tokens,obtainedAt:now,expiresAt:now+Math.max(0,tokens.expires_in-60)*1000,refreshExpiresAt:now+Math.max(0,tokens.refresh_expires_in-60)*1000},"Secure TikTok token storage is not available on this system.");
}
export const loadTikTokTokens=()=>loadEncrypted<StoredTikTokTokens>(tokenPath());
export const saveTikTokOAuthConfig=(config:TikTokOAuthConfig)=>saveEncrypted(configPath(),config,"Secure TikTok OAuth configuration storage is not available on this system.");
export const loadTikTokOAuthConfig=()=>loadEncrypted<TikTokOAuthConfig>(configPath());
