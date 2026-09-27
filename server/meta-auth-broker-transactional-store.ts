import type { MetaBrokerSession,MetaBrokerSessionStoreContract } from "./meta-auth-broker-core";

export type TransactionalMetaBrokerAdapter={
 create(session:MetaBrokerSession,ttlMs:number):Promise<void>;
 get(id:string):Promise<MetaBrokerSession|null>;
 complete(id:string,code:string):Promise<MetaBrokerSession|null>;
 consume(id:string,state:string):Promise<MetaBrokerSession|null>;
};
export class TransactionalMetaBrokerSessionStore implements MetaBrokerSessionStoreContract{
 constructor(private adapter:TransactionalMetaBrokerAdapter,private ttlMs=5*60_000){}
 async create(input:Omit<MetaBrokerSession,"id"|"createdAt"|"used">){const session:MetaBrokerSession={...input,id:crypto.randomUUID(),createdAt:Date.now(),used:false};await this.adapter.create(session,this.ttlMs);return session;}
 async get(id:string){return this.adapter.get(id);}
 async complete(id:string,code:string){const session=await this.adapter.complete(id,code);if(!session)throw new Error("Broker session is missing, expired, or already used.");return session;}
 async consume(id:string,state:string){const session=await this.adapter.consume(id,state);if(!session)throw new Error("Broker session is missing, expired, already used, or state did not match.");return session;}
}
