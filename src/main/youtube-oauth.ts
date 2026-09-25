export type YouTubeTokenResponse = {
  access_token:string;
  expires_in:number;
  refresh_token?:string;
  scope?:string;
  token_type:string;
};

export async function exchangeYouTubeAuthorizationCode(input:{ clientId:string; clientSecret?:string; code:string; redirectUri:string }):Promise<YouTubeTokenResponse> {
  const body=new URLSearchParams({ client_id:input.clientId, code:input.code, grant_type:"authorization_code", redirect_uri:input.redirectUri });
  if (input.clientSecret) body.set("client_secret",input.clientSecret);
  const response=await fetch("https://oauth2.googleapis.com/token",{ method:"POST", headers:{"content-type":"application/x-www-form-urlencoded"}, body });
  const data=await response.json() as Partial<YouTubeTokenResponse> & { error?:string; error_description?:string };
  if (!response.ok || !data.access_token) throw new Error(data.error_description || data.error || "YouTube token exchange failed.");
  return data as YouTubeTokenResponse;
}
