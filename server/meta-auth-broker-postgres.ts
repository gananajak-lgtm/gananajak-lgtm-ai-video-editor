import type { MetaBrokerSession } from "./meta-auth-broker-core";
import type { TransactionalMetaBrokerAdapter } from "./meta-auth-broker-transactional-store";

export type SqlQueryResult<T>={rows:T[]};
export type SqlClient={query<T=Record<string,unknown>>(sql:string,params?:unknown[]):Promise<SqlQueryResult<T>>;release():void};
export type SqlPool={query<T=Record<string,unknown>>(sql:string,params?:unknown[]):Promise<SqlQueryResult<T>>;connect():Promise<SqlClient>;end?:()=>Promise<void>};
type Row={id:string;client_id:string;state:string;desktop_redirect_uri:string;created_at:Date;used:boolean;code:string|null};
const fromRow=(r:Row):MetaBrokerSession=>({id:r.id,clientId:r.client_id,state:r.state,desktopRedirectUri:r.desktop_redirect_uri,createdAt:new Date(r.created_at).getTime(),used:r.used,code:r.code??undefined});
export class PostgresMetaBrokerAdapter implements TransactionalMetaBrokerAdapter{
 constructor(private pool:SqlPool){}
 async migrate(){await this.pool.query(`CREATE TABLE IF NOT EXISTS meta_broker_schema_migrations (version integer PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())`);const version=await this.pool.query<{version:number}>(`SELECT version FROM meta_broker_schema_migrations WHERE version=1`);if(version.rows.length)return;await this.pool.query(`CREATE TABLE IF NOT EXISTS meta_broker_sessions (id text PRIMARY KEY,client_id text NOT NULL,state text NOT NULL,desktop_redirect_uri text NOT NULL,created_at timestamptz NOT NULL,expires_at timestamptz NOT NULL,used boolean NOT NULL DEFAULT false,code text)`);await this.pool.query(`CREATE INDEX IF NOT EXISTS meta_broker_sessions_expires_idx ON meta_broker_sessions(expires_at)`);await this.pool.query(`INSERT INTO meta_broker_schema_migrations(version) VALUES(1) ON CONFLICT DO NOTHING`);}
 async ready(){await this.pool.query(`SELECT 1`);return true;}
 async create(s:MetaBrokerSession,ttlMs:number){await this.pool.query(`INSERT INTO meta_broker_sessions(id,client_id,state,desktop_redirect_uri,created_at,expires_at,used,code) VALUES($1,$2,$3,$4,to_timestamp($5/1000.0),to_timestamp(($5+$6)/1000.0),false,NULL)`,[s.id,s.clientId,s.state,s.desktopRedirectUri,s.createdAt,ttlMs]);}
 async get(id:string){const r=await this.pool.query<Row>(`SELECT id,client_id,state,desktop_redirect_uri,created_at,used,code FROM meta_broker_sessions WHERE id=$1 AND expires_at>now()`,[id]);return r.rows[0]?fromRow(r.rows[0]):null;}
 async complete(id:string,code:string){const r=await this.pool.query<Row>(`UPDATE meta_broker_sessions SET code=$2 WHERE id=$1 AND expires_at>now() AND used=false RETURNING id,client_id,state,desktop_redirect_uri,created_at,used,code`,[id,code]);return r.rows[0]?fromRow(r.rows[0]):null;}
 async consume(id:string,state:string){const client=await this.pool.connect();try{await client.query("BEGIN");const found=await client.query<Row>(`SELECT id,client_id,state,desktop_redirect_uri,created_at,used,code FROM meta_broker_sessions WHERE id=$1 AND expires_at>now() FOR UPDATE`,[id]);const row=found.rows[0];if(!row||row.used||row.state!==state||!row.code){await client.query("ROLLBACK");return null;}const updated=await client.query<Row>(`UPDATE meta_broker_sessions SET used=true WHERE id=$1 AND used=false RETURNING id,client_id,state,desktop_redirect_uri,created_at,used,code`,[id]);await client.query("COMMIT");return updated.rows[0]?fromRow(updated.rows[0]):null;}catch(error){try{await client.query("ROLLBACK");}catch{}throw error;}finally{client.release();}}
 async cleanup(){await this.pool.query(`DELETE FROM meta_broker_sessions WHERE expires_at<=now()`);}
}
