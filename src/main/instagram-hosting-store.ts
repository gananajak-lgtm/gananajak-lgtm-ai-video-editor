import { app,safeStorage } from "electron";
import path from "node:path";
import { mkdir,readFile,writeFile } from "node:fs/promises";
import type { InstagramHostingConfig } from "./instagram-hosting";
const filePath=()=>path.join(app.getPath("userData"),"publish","instagram-hosting.bin");
export async function saveInstagramHostingConfig(config:InstagramHostingConfig){if(!safeStorage.isEncryptionAvailable())throw new Error("Secure Instagram hosting credential storage is unavailable.");await mkdir(path.dirname(filePath()),{recursive:true});await writeFile(filePath(),safeStorage.encryptString(JSON.stringify(config)));}
export async function loadInstagramHostingConfig():Promise<InstagramHostingConfig|null>{try{if(!safeStorage.isEncryptionAvailable())return null;return JSON.parse(safeStorage.decryptString(await readFile(filePath()))) as InstagramHostingConfig;}catch{return null;}}
