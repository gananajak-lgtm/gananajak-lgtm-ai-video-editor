export type MetaOAuthConfig={appId:string;appSecret:string;redirectUri:string};
export type MetaTokenResponse={access_token:string;token_type?:string;expires_in?:number};

const GRAPH="https://graph.facebook.com";

async function json<T>(response:Response):Promise<T>{
  const data=await response.json() as T&{error?:{message?:string;type?:string;code?:number}};
  if(!response.ok || data.error) throw new Error(data.error?.message || `Meta API request failed (HTTP ${response.status}).`);
  return data;
}

export async function exchangeMetaAuthorizationCode(input:MetaOAuthConfig&{code:string}):Promise<MetaTokenResponse>{
  const params=new URLSearchParams({client_id:input.appId,client_secret:input.appSecret,redirect_uri:input.redirectUri,code:input.code});
  return json<MetaTokenResponse>(await fetch(`${GRAPH}/oauth/access_token?${params}`));
}

export async function exchangeMetaLongLivedToken(input:{appId:string;appSecret:string;accessToken:string}):Promise<MetaTokenResponse>{
  const params=new URLSearchParams({grant_type:"fb_exchange_token",client_id:input.appId,client_secret:input.appSecret,fb_exchange_token:input.accessToken});
  return json<MetaTokenResponse>(await fetch(`${GRAPH}/oauth/access_token?${params}`));
}
