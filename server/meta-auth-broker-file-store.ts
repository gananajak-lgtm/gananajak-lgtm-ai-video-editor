import { mkdirSync,readFileSync,renameSync,writeFileSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import type { MetaBrokerSession,MetaBrokerSessionStoreContract } from "./meta-auth-broker-core";

export class FileMetaBrokerSessionStore implements MetaBrokerSessionStoreContract{
 private sessions=new Map<string,MetaBrokerSession>();
 constructor(private filePath:string,private ttlMs=5*60_000){this.load();this.pruneAndPersist();}
 create(input:Omit<MetaBrokerSession,"id"|"createdAt"|"used">){this.prune();const session:MetaBrokerSession={...input,id:randomBytes(24).toString("base64url"),createdAt:Date.now(),used:false};this.sessions.set(session.id,session);this.persist();return session;}
 get(id:string){this.prune();return this.sessions.get(id)??null;}
 complete(id:string,code:string){const session=this.require(id);if(session.used)throw new Error("Broker session was already used.");session.code=code;this.persist();return session;}
 consume(id:string,state:string){const session=this.require(id);if(session.used)throw new Error("Broker session was already used.");if(session.state!==state)throw new Error("Broker session state mismatch.");if(!session.code)throw new Error("Meta authorization has not completed yet.");session.used=true;this.persist();return session;}
 private require(id:string){this.prune();const session=this.sessions.get(id);if(!session)throw new Error("Broker session is missing or expired.");return session;}
 private prune(){const now=Date.now();for(const [id,s] of this.sessions)if(now-s.createdAt>this.ttlMs)this.sessions.delete(id);}
 private pruneAndPersist(){const before=this.sessions.size;this.prune();if(before!==this.sessions.size)this.persist();}
 private load(){try{const parsed=JSON.parse(readFileSync(this.filePath,"utf8")) as MetaBrokerSession[];for(const session of parsed)if(session?.id)this.sessions.set(session.id,session);}catch{}}
 private persist(){mkdirSync(path.dirname(this.filePath),{recursive:true});const tmp=`${this.filePath}.${process.pid}.tmp`;writeFileSync(tmp,JSON.stringify([...this.sessions.values()]),{encoding:"utf8",mode:0o600});renameSync(tmp,this.filePath);}
}
