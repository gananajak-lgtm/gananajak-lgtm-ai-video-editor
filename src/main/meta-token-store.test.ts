import assert from "node:assert/strict";
import test from "node:test";
import { isMetaTokenUsable } from "./meta-token-store";
test("treats expired Meta tokens as disconnected",()=>{const now=2_000_000;assert.equal(isMetaTokenUsable({access_token:"token",obtainedAt:1,expiresAt:now-1},now),false);assert.equal(isMetaTokenUsable({access_token:"token",obtainedAt:1,expiresAt:now+1},now),true);});
test("supports legacy Meta tokens without explicit expiry",()=>{assert.equal(isMetaTokenUsable({access_token:"token",obtainedAt:1}),true);assert.equal(isMetaTokenUsable(null),false);});
