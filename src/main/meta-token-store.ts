import { app, safeStorage } from "electron";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { MetaOAuthConfig, MetaTokenResponse } from "./meta-oauth";

export type StoredMetaToken=MetaTokenResponse&{obtainedAt:number;expiresAt?:number};
const root=()=>path.join(app.getPath("userData"),"publish");
const configPath=()=>path.join(root(),"meta-oauth-config.bin");
const tokenPath=()=>path.join(root(),"meta-token.bin");

async function saveEncrypted(filePath:string,value:unknown){
  if(!safeStorage.isEncryptionAvailable()) throw new Error("Secure Meta credential storage is not available on this system.");
  await mkdir(path.dirname(filePath),{recursive:true}); await writeFile(filePath,safeStorage.encryptString(JSON.stringify(value)));
}
async function loadEncrypted<T>(filePath:string):Promise<T|null>{
  try{if(!safeStorage.isEncryptionAvailable()) return null;return JSON.parse(safeStorage.decryptString(await readFile(filePath))) as T;}catch{return null;}
}
export const saveMetaOAuthConfig=(config:MetaOAuthConfig)=>saveEncrypted(configPath(),config);
export const loadMetaOAuthConfig=()=>loadEncrypted<MetaOAuthConfig>(configPath());
export async function saveMetaToken(token:MetaTokenResponse){const now=Date.now();await saveEncrypted(tokenPath(),{...token,obtainedAt:now,expiresAt:token.expires_in?now+Math.max(0,token.expires_in-60)*1000:undefined});}
export const loadMetaToken=()=>loadEncrypted<StoredMetaToken>(tokenPath());
