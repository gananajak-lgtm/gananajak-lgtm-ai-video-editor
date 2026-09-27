import { app, safeStorage } from "electron";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { TikTokShopCreatorCredentials } from "./tiktok-shop-showcase-provider";

export type TikTokShopCreatorStatus={connected:boolean;displayName?:string;scopes:string[]};
export type TikTokShopAppConfig={appKey:string;appSecret:string};

const configPath=()=>path.join(app.getPath("userData"),"affiliate","tiktok-shop-app.bin");
const credentialsPath=()=>path.join(app.getPath("userData"),"affiliate","tiktok-shop-creator.bin");

export async function saveTikTokShopAppConfig(value:TikTokShopAppConfig){if(!safeStorage.isEncryptionAvailable())throw new Error("Secure TikTok Shop app configuration storage is not available on this system.");await mkdir(path.dirname(configPath()),{recursive:true});await writeFile(configPath(),safeStorage.encryptString(JSON.stringify(value)));}
export async function loadTikTokShopAppConfig():Promise<TikTokShopAppConfig|null>{try{if(!safeStorage.isEncryptionAvailable())return null;return JSON.parse(safeStorage.decryptString(await readFile(configPath()))) as TikTokShopAppConfig;}catch{return null;}}

export async function saveTikTokShopCreatorCredentials(value:TikTokShopCreatorCredentials){
  if(!safeStorage.isEncryptionAvailable())throw new Error("Secure TikTok Shop credential storage is not available on this system.");
  await mkdir(path.dirname(credentialsPath()),{recursive:true});
  await writeFile(credentialsPath(),safeStorage.encryptString(JSON.stringify(value)));
}
export async function loadTikTokShopCreatorCredentials():Promise<TikTokShopCreatorCredentials|null>{
  try{
    if(!safeStorage.isEncryptionAvailable())return null;
    return JSON.parse(safeStorage.decryptString(await readFile(credentialsPath()))) as TikTokShopCreatorCredentials;
  }catch{return null;}
}

export async function getTikTokShopCreatorStatus():Promise<TikTokShopCreatorStatus>{const credentials=await loadTikTokShopCreatorCredentials();return {connected:Boolean(credentials),displayName:credentials?"TikTok Shop Creator":undefined,scopes:credentials?["creator.showcase.read"]:[]};}
