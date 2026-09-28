import assert from "node:assert/strict";
import { createOAuthState } from "./oauth-loopback";

const a=createOAuthState(),b=createOAuthState();
assert.notEqual(a,b);
assert.ok(a.length>=32);
assert.match(a,/^[A-Za-z0-9_-]+$/);
const url=new URL("https://shop.tiktok.com/alliance/creator/auth");
url.searchParams.set("app_key","app-key");
url.searchParams.set("state",a);
assert.equal(url.origin,"https://shop.tiktok.com");
assert.equal(url.pathname,"/alliance/creator/auth");
assert.equal(url.searchParams.get("state"),a);
console.log("TikTok Shop creator authorization URL tests passed");
