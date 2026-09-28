import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync,rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { FileMetaBrokerSessionStore } from "./meta-auth-broker-file-store";
test("file broker store survives restart and preserves single-use state",()=>{const dir=mkdtempSync(path.join(os.tmpdir(),"meta-broker-"));try{const file=path.join(dir,"sessions.json");const first=new FileMetaBrokerSessionStore(file);const session=first.create({clientId:"desktop",state:"state",desktopRedirectUri:"http://127.0.0.1:54321/meta-broker-callback"});first.complete(session.id,"code");const restarted=new FileMetaBrokerSessionStore(file);assert.equal(restarted.get(session.id)?.code,"code");assert.equal(restarted.consume(session.id,"state").used,true);const again=new FileMetaBrokerSessionStore(file);assert.throws(()=>again.consume(session.id,"state"),/already used/);}finally{rmSync(dir,{recursive:true,force:true});}});
