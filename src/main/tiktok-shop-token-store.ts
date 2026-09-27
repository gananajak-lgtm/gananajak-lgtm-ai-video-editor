import { app, safeStorage } from "electron";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { TikTokShopCreatorCredentials } from "./tiktok-shop-showcase-provider";
import { refreshTikTokShopCreatorToken, type TikTokShopTokenResponse } from "./tiktok-shop-oauth";

export type TikTokShopCreatorStatus={connected:boolean;displayName?:string;scopes:string[]};
export type StoredTikTokShopCreatorCredentials=TikTokShopCreatorCredentials & {refreshToken?:string;openId?:string;grantedScopes?:string[];expiresAt?:number};
export type TikTokShopAppConfig={appKey:string;appSecret:string};

const configPath=()=>path.join(app.getPath("userData"),"affiliate","tiktok-shop-app.bin");
const credentialsPath=()=>path.join(app.getPath("userData"),"affiliate","tiktok-shop-creator.bin");

export async function saveTikTokShopAppConfig(value:TikTokShopAppConfig){if(!safeStorage.isEncryptionAvailable())throw new Error("Secure TikTok Shop app configuration storage is not available on this system.");await mkdir(path.dirname(configPath()),{recursive:true});await writeFile(configPath(),safeStorage.encryptString(JSON.stringify(value)));}
export async function loadTikTokShopAppConfig():Promise<TikTokShopAppConfig|null>{try{if(!safeStorage.isEncryptionAvailable())return null;return JSON.parse(safeStorage.decryptString(await readFile(configPath()))) as TikTokShopAppConfig;}catch{return null;}}

export async function saveTikTokShopCreatorCredentials(value:TikTokShopCreatorCredentials|StoredTikTokShopCreatorCredentials){
  if(!safeStorage.isEncryptionAvailable())throw new Error("Secure TikTok Shop credential storage is not available on this system.");
  await mkdir(path.dirname(credentialsPath()),{recursive:true});
  await writeFile(credentialsPath(),safeStorage.encryptString(JSON.stringify(value)));
}
export async function saveTikTokShopCreatorToken(app:TikTokShopAppConfig,token:TikTokShopTokenResponse){const now=Date.now();await saveTikTokShopCreatorCredentials({appKey:app.appKey,appSecret:app.appSecret,accessToken:token.access_token,refreshToken:token.refresh_token,openId:token.open_id,grantedScopes:token.granted_scopes,expiresAt:now+Math.max(0,(token.access_token_expire_in??86400)-60)*1000});}
export async function loadTikTokShopCreatorCredentials():Promise<StoredTikTokShopCreatorCredentials|null>{
  try{
    if(!safeStorage.isEncryptionAvailable())return null;
    return JSON.parse(safeStorage.decryptString(await readFile(credentialsPath()))) as StoredTikTokShopCreatorCredentials;
  }catch{return null;}
}

export async function loadUsableTikTokShopCreatorCredentials():Promise<StoredTikTokShopCreatorCredentials|null>{let credentials=await loadTikTokShopCreatorCredentials();if(!credentials)return null;if(credentials.expiresAt&&credentials.expiresAt>Date.now())return credentials;if(!credentials.refreshToken)return null;const token=await refreshTikTokShopCreatorToken({appKey:credentials.appKey,appSecret:credentials.appSecret,refreshToken:credentials.refreshToken});const config={appKey:credentials.appKey,appSecret:credentials.appSecret};await saveTikTokShopCreatorToken(config,token);credentials=await loadTikTokShopCreatorCredentials();return credentials;}

export async function getTikTokShopCreatorStatus():Promise<TikTokShopCreatorStatus>{const credentials=await loadTikTokShopCreatorCredentials();return {connected:Boolean(credentials),displayName:credentials?.openId?"TikTok Shop Creator":"TikTok Shop Creator",scopes:credentials?.grantedScopes??[]};}
