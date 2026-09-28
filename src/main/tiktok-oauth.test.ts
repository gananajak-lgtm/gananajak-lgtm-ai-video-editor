import assert from "node:assert/strict";
import test from "node:test";
import { createTikTokPkce, exchangeTikTokAuthorizationCode, refreshTikTokAccessToken } from "./tiktok-oauth";

test("creates TikTok desktop PKCE verifier and hex SHA256 challenge",()=>{
  const pkce=createTikTokPkce();
  assert.ok(pkce.verifier.length>=43 && pkce.verifier.length<=128);
  assert.match(pkce.verifier,/^[A-Za-z0-9._~-]+$/);
  assert.match(pkce.challenge,/^[a-f0-9]{64}$/);
});

test("mocks TikTok authorization code exchange and refresh",async(t)=>{
  const originalFetch=globalThis.fetch; const bodies:string[]=[];
  globalThis.fetch=(async(_input:string|URL|Request,init?:RequestInit)=>{
    bodies.push(String(init?.body));
    return new Response(JSON.stringify({access_token:"access",expires_in:86400,open_id:"open",refresh_expires_in:31536000,refresh_token:"refresh",scope:"user.info.basic,video.publish",token_type:"Bearer"}),{status:200});
  }) as typeof fetch;
  t.after(()=>{globalThis.fetch=originalFetch;});
  const exchanged=await exchangeTikTokAuthorizationCode({clientKey:"key",clientSecret:"secret",code:"code",redirectUri:"http://127.0.0.1:3455/callback/",codeVerifier:"verifier"});
  assert.equal(exchanged.open_id,"open"); assert.match(bodies[0],/code_verifier=verifier/); assert.match(bodies[0],/grant_type=authorization_code/);
  await refreshTikTokAccessToken({clientKey:"key",clientSecret:"secret",refreshToken:"refresh"});
  assert.match(bodies[1],/grant_type=refresh_token/); assert.match(bodies[1],/refresh_token=refresh/);
});
