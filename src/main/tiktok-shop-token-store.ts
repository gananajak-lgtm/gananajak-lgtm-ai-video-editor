import { app, safeStorage } from "electron";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { TikTokShopCreatorCredentials } from "./tiktok-shop-showcase-provider";

const credentialsPath=()=>path.join(app.getPath("userData"),"affiliate","tiktok-shop-creator.bin");

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
