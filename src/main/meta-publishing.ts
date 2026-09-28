export type MetaPage={id:string;name:string;accessToken:string;instagramBusinessAccountId?:string};
const GRAPH="https://graph.facebook.com";

async function graph<T>(path:string,accessToken:string):Promise<T>{
 const join=path.includes("?")?"&":"?";
 const response=await fetch(`${GRAPH}/${path}${join}access_token=${encodeURIComponent(accessToken)}`);
 const data=await response.json() as T&{error?:{message?:string}};
 if(!response.ok||data.error) throw new Error(data.error?.message||`Meta Graph request failed (HTTP ${response.status}).`);
 return data;
}

export async function listMetaPublishingPages(userAccessToken:string):Promise<MetaPage[]>{
 const data=await graph<{data:Array<{id:string;name:string;access_token:string;instagram_business_account?:{id:string}}>}>(`me/accounts?fields=id,name,access_token,instagram_business_account`,userAccessToken);
 return (data.data??[]).map(page=>({id:page.id,name:page.name,accessToken:page.access_token,instagramBusinessAccountId:page.instagram_business_account?.id}));
}
