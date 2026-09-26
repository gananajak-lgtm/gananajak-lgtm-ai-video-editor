import { createHash, randomBytes } from "node:crypto";

export type TikTokTokenResponse = {
  access_token:string;
  expires_in:number;
  open_id:string;
  refresh_expires_in:number;
  refresh_token:string;
  scope:string;
  token_type:string;
};

export function createTikTokPkce() {
  const verifier=randomBytes(64).toString("base64url");
  return { verifier, challenge:createHash("sha256").update(verifier).digest("hex") };
}

async function tokenRequest(body:URLSearchParams):Promise<TikTokTokenResponse> {
  const response=await fetch("https://open.tiktokapis.com/v2/oauth/token/",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body});
  const data=await response.json() as Partial<TikTokTokenResponse>&{error?:string;error_description?:string};
  if(!response.ok || !data.access_token) throw new Error(data.error_description || data.error || "TikTok token request failed.");
  return data as TikTokTokenResponse;
}

export async function exchangeTikTokAuthorizationCode(input:{clientKey:string;clientSecret:string;code:string;redirectUri:string;codeVerifier:string}) {
  return tokenRequest(new URLSearchParams({client_key:input.clientKey,client_secret:input.clientSecret,code:input.code,grant_type:"authorization_code",redirect_uri:input.redirectUri,code_verifier:input.codeVerifier}));
}

export async function refreshTikTokAccessToken(input:{clientKey:string;clientSecret:string;refreshToken:string}) {
  return tokenRequest(new URLSearchParams({client_key:input.clientKey,client_secret:input.clientSecret,grant_type:"refresh_token",refresh_token:input.refreshToken}));
}
