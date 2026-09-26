import assert from "node:assert/strict";
import test from "node:test";
import { buildMetaAuthorizationUrl, exchangeMetaAuthorizationCode, exchangeMetaLongLivedToken } from "./meta-oauth";

test("builds Meta publishing authorization with page and Instagram scopes",()=>{
 const url=new URL(buildMetaAuthorizationUrl({appId:"123",redirectUri:"https://example.com/oauth/meta",state:"state"}));
 assert.equal(url.searchParams.get("client_id"),"123"); assert.equal(url.searchParams.get("state"),"state");
 const scopes=(url.searchParams.get("scope")??"").split(",");
 for(const scope of ["pages_show_list","pages_manage_posts","instagram_basic","instagram_content_publish"]) assert.ok(scopes.includes(scope));
});
test("mocks Meta code and long-lived token exchanges",async(t)=>{
 const original=globalThis.fetch; const urls:string[]=[];
 globalThis.fetch=(async(input:string|URL|Request)=>{urls.push(String(input));return new Response(JSON.stringify({access_token:"token",token_type:"bearer",expires_in:5184000}),{status:200});}) as typeof fetch;
 t.after(()=>{globalThis.fetch=original;});
 await exchangeMetaAuthorizationCode({appId:"id",appSecret:"secret",redirectUri:"https://example.com/oauth/meta",code:"code"});
 await exchangeMetaLongLivedToken({appId:"id",appSecret:"secret",accessToken:"short"});
 assert.match(urls[0],/oauth\/access_token/); assert.match(urls[1],/fb_exchange_token=short/);
});
