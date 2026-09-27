import { randomBytes } from "node:crypto";

export type MetaBrokerServerConfig={appId:string;appSecret:string;publicBaseUrl:string;allowedClientIds:Set<string>;sessionTtlMs?:number};
type Session={id:string;clientId:string;state:string;desktopRedirectUri:string;createdAt:number;used:boolean;code?:string};
export class MetaBrokerSessionStore{
 private sessions=new Map<string,Session>();
 constructor(private ttlMs=5*60_000){}
 create(input:Omit<Session,"id"|"createdAt"|"used">){this.prune();const session:Session={...input,id:randomBytes(24).toString("base64url"),createdAt:Date.now(),used:false};this.sessions.set(session.id,session);return session;}
 get(id:string){const session=this.sessions.get(id);if(!session)return null;if(Date.now()-session.createdAt>this.ttlMs){this.sessions.delete(id);return null;}return session;}
 complete(id:string,code:string){const session=this.get(id);if(!session)throw new Error("Broker session is missing or expired.");if(session.used)throw new Error("Broker session was already used.");session.code=code;return session;}
 consume(id:string,state:string){const session=this.get(id);if(!session)throw new Error("Broker session is missing or expired.");if(session.used)throw new Error("Broker session was already used.");if(session.state!==state)throw new Error("Broker session state mismatch.");if(!session.code)throw new Error("Meta authorization has not completed yet.");session.used=true;return session;}
 private prune(){const now=Date.now();for(const [id,s] of this.sessions)if(now-s.createdAt>this.ttlMs)this.sessions.delete(id);}
}
export function validateDesktopRedirectUri(value:string){const url=new URL(value);if(url.protocol!=="http:"||url.hostname!=="127.0.0.1"||!url.port||url.pathname!=="/meta-broker-callback")throw new Error("Desktop callback must be an exact 127.0.0.1 loopback callback.");return url.toString();}
export function validateBrokerPublicUrl(value:string){const url=new URL(value);if(url.protocol!=="https:")throw new Error("Broker public URL must use HTTPS.");return url.toString().replace(/\/$/,"");}
export function createMetaAuthorizationUrl(config:MetaBrokerServerConfig,input:{sessionId:string;state:string}){
 const base=validateBrokerPublicUrl(config.publicBaseUrl),redirectUri=`${base}/meta/oauth/callback`;
 const p=new URLSearchParams({client_id:config.appId,redirect_uri:redirectUri,state:input.state,response_type:"code",scope:"pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish"});
 return `https://www.facebook.com/dialog/oauth?${p}`;
}
export async function exchangeMetaServerCode(config:MetaBrokerServerConfig,code:string){
 const redirectUri=`${validateBrokerPublicUrl(config.publicBaseUrl)}/meta/oauth/callback`;
 const p=new URLSearchParams({client_id:config.appId,client_secret:config.appSecret,redirect_uri:redirectUri,code});
 const response=await fetch(`https://graph.facebook.com/oauth/access_token?${p}`);const data=await response.json() as {access_token?:string;expires_in?:number;token_type?:string;error?:{message?:string}};
 if(!response.ok||!data.access_token)throw new Error(data.error?.message||`Meta token exchange failed (HTTP ${response.status}).`);return data as {access_token:string;expires_in?:number;token_type?:string};
}
