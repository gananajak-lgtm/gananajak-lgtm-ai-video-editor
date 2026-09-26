import { createServer } from "node:http";
import { randomBytes } from "node:crypto";

export type OAuthCallback = { code:string; state:string; redirectUri:string };
export type OAuthLoopback = { redirectUri:string; callback:Promise<OAuthCallback>; close:()=>void };

export function createOAuthState() { return randomBytes(32).toString("base64url"); }

export async function startOAuthLoopback(expectedState:string, timeoutMs=120_000, callbackPath=""):Promise<OAuthLoopback> {
  let close=()=>{};
  let resolveCallback!:(value:OAuthCallback)=>void;
  let rejectCallback!:(reason:Error)=>void;
  const callback=new Promise<OAuthCallback>((resolve,reject)=>{resolveCallback=resolve;rejectCallback=reject;});
  const server=createServer((req,res)=>{
    const address=server.address(); if (!address || typeof address==="string") return;
    const redirectUri=`http://127.0.0.1:${address.port}${callbackPath}`;
    const url=new URL(req.url ?? "/",redirectUri);
    const error=url.searchParams.get("error"), code=url.searchParams.get("code"), state=url.searchParams.get("state");
    if(error){res.end("Authorization was not completed. You can close this window.");close();rejectCallback(new Error(error));return;}
    if(!code || !state || state!==expectedState){res.statusCode=400;res.end("Invalid OAuth callback. You can close this window.");close();rejectCallback(new Error("Invalid OAuth callback state."));return;}
    res.end("Account connected. You can return to Gananajak AI Video Editor.");close();resolveCallback({code,state,redirectUri});
  });
  await new Promise<void>((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",()=>resolve());});
  const address=server.address(); if(!address || typeof address==="string"){server.close();throw new Error("Could not allocate OAuth callback port.");}
  const timer=setTimeout(()=>{server.close();rejectCallback(new Error("OAuth authorization timed out."));},timeoutMs);
  close=()=>{clearTimeout(timer);server.close();};
  return {redirectUri:`http://127.0.0.1:${address.port}${callbackPath}`,callback,close};
}
