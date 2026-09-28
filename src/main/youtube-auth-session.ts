import { loadYouTubeOAuthConfig, loadYouTubeTokens, saveYouTubeTokens } from "./youtube-token-store";
import { refreshYouTubeAccessToken } from "./youtube-oauth";

export async function getValidYouTubeAccessToken() {
  const tokens=await loadYouTubeTokens();
  if(!tokens) throw new Error("YouTube is not connected.");
  if(tokens.expiresAt>Date.now()) return tokens.access_token;
  if(!tokens.refresh_token) throw new Error("YouTube authorization expired. Reconnect YouTube.");
  const config=await loadYouTubeOAuthConfig();
  if(!config) throw new Error("YouTube OAuth configuration is missing.");
  const refreshed=await refreshYouTubeAccessToken({clientId:config.clientId,clientSecret:config.clientSecret,refreshToken:tokens.refresh_token});
  await saveYouTubeTokens(refreshed);
  return refreshed.access_token;
}
