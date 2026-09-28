export type TikTokShopTokenResponse={access_token:string;refresh_token:string;access_token_expire_in?:number;refresh_token_expire_in?:number;open_id:string;user_type:number;granted_scopes:string[]};

async function tokenGet(path:string,params:URLSearchParams):Promise<TikTokShopTokenResponse>{
  const response=await fetch(`https://auth.tiktok-shops.com${path}?${params.toString()}`);
  const payload=await response.json() as {code?:number;message?:string;data?:TikTokShopTokenResponse};
  if(!response.ok||payload.code!==0||!payload.data?.access_token)throw new Error(payload.message||"TikTok Shop token request failed.");
  if(payload.data.user_type!==1)throw new Error("TikTok Shop authorization is not a Creator account.");
  const scopes=payload.data.granted_scopes??[];
  if(!scopes.includes("creator.showcase.read")&&!scopes.includes("creator.video.write"))throw new Error("TikTok Shop Creator did not grant Showcase access.");
  return {...payload.data,granted_scopes:scopes};
}
export function exchangeTikTokShopCreatorCode(input:{appKey:string;appSecret:string;authCode:string}){
  return tokenGet("/api/v2/token/get",new URLSearchParams({app_key:input.appKey,app_secret:input.appSecret,auth_code:input.authCode,grant_type:"authorized_code"}));
}
export function refreshTikTokShopCreatorToken(input:{appKey:string;appSecret:string;refreshToken:string}){
  return tokenGet("/api/v2/token/refresh",new URLSearchParams({app_key:input.appKey,app_secret:input.appSecret,refresh_token:input.refreshToken,grant_type:"refresh_token"}));
}
