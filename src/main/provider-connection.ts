import { getElevenLabsApiKey, getOpenAiApiKey } from "./settings";

export type ProviderConnectionResult = {
  provider: "openai" | "elevenlabs";
  configured: boolean;
  connected: boolean;
  status: "missing_key" | "connected" | "unauthorized" | "rate_limited" | "network_error" | "provider_error";
};

async function check(provider: ProviderConnectionResult["provider"], key: string | null): Promise<ProviderConnectionResult> {
  if (!key) return { provider, configured: false, connected: false, status: "missing_key" };
  const url = provider === "openai" ? "https://api.openai.com/v1/models" : "https://api.elevenlabs.io/v1/user";
  const headers = new Headers();
  if (provider === "openai") headers.set("Authorization", `Bearer ${key}`);
  else headers.set("xi-api-key", key);
  try {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
    const status = response.ok ? "connected" : response.status === 401 || response.status === 403 ? "unauthorized" : response.status === 429 ? "rate_limited" : "provider_error";
    return { provider, configured: true, connected: response.ok, status };
  } catch {
    return { provider, configured: true, connected: false, status: "network_error" };
  }
}

/** Never returns API keys, raw provider responses, or potentially sensitive error messages. */
export async function checkProviderConnection(provider: ProviderConnectionResult["provider"]): Promise<ProviderConnectionResult> {
  return check(provider, provider === "openai" ? await getOpenAiApiKey() : await getElevenLabsApiKey());
}
