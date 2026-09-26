export type MetaBrokerConfig={baseUrl:string;clientId:string};
export type MetaBrokerSession={authorizationUrl:string;sessionId:string};
export type MetaBrokerToken={access_token:string;token_type?:string;expires_in?:number};

export function validateMetaBrokerConfig(config:MetaBrokerConfig){
 const url=new URL(config.baseUrl);
 if(url.protocol!=="https:") throw new Error("Meta Auth Broker must use HTTPS.");
 if(["localhost","127.0.0.1","::1"].includes(url.hostname)) throw new Error("Production Meta Auth Broker cannot use localhost.");
 if(!config.clientId.trim()) throw new Error("Meta Auth Broker client ID is required.");
 return {baseUrl:url.toString().replace(/\/$/,""),clientId:config.clientId.trim()};
}
async function brokerJson<T>(response:Response){const data=await response.json() as T&{error?:string};if(!response.ok)throw new Error(data.error||`Meta Auth Broker failed (HTTP ${response.status}).`);return data;}
export async function createMetaBrokerSession(config:MetaBrokerConfig,state:string){
 const safe=validateMetaBrokerConfig(config);
 return brokerJson<MetaBrokerSession>(await fetch(`${safe.baseUrl}/meta/oauth/session`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({clientId:safe.clientId,state})}));
}
export async function exchangeMetaBrokerSession(config:MetaBrokerConfig,input:{sessionId:string;code:string;state:string}){
 const safe=validateMetaBrokerConfig(config);
 return brokerJson<MetaBrokerToken>(await fetch(`${safe.baseUrl}/meta/oauth/exchange`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({clientId:safe.clientId,...input})}));
}
