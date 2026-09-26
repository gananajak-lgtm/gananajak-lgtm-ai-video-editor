import { app, safeStorage } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import type { AiSettingsStatus } from "../shared/types";

type PersistedSettings = {
  openAiApiKeyEncrypted?: string;
  replicateApiTokenEncrypted?: string;
  elevenLabsApiKeyEncrypted?: string;
};

let sessionApiKey: string | null = null;
let sessionReplicateToken: string | null = null;
let sessionElevenLabsKey: string | null = null;

function settingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

async function readSettings(): Promise<PersistedSettings> {
  try {
    const raw = await fs.readFile(settingsPath(), "utf8");
    return JSON.parse(raw) as PersistedSettings;
  } catch {
    return {};
  }
}

async function writeSettings(settings: PersistedSettings) {
  await fs.mkdir(path.dirname(settingsPath()), { recursive: true });
  await fs.writeFile(settingsPath(), JSON.stringify(settings, null, 2), "utf8");
}

export async function getOpenAiApiKey(): Promise<string | null> {
  if (sessionApiKey) return sessionApiKey;

  const fromEnvironment = process.env.OPENAI_API_KEY?.trim();
  if (fromEnvironment) return fromEnvironment;

  if (!safeStorage.isEncryptionAvailable()) return null;

  const settings = await readSettings();
  if (!settings.openAiApiKeyEncrypted) return null;

  try {
    return safeStorage.decryptString(
      Buffer.from(settings.openAiApiKeyEncrypted, "base64")
    );
  } catch {
    return null;
  }
}

export async function getAiSettingsStatus(): Promise<AiSettingsStatus> {
  const configured = Boolean(await getOpenAiApiKey());

  if (!configured) {
    return { configured: false, persistedSecurely: false };
  }

  if (process.env.OPENAI_API_KEY?.trim()) {
    return { configured: true, persistedSecurely: false };
  }

  const settings = await readSettings();
  return {
    configured: true,
    persistedSecurely:
      safeStorage.isEncryptionAvailable() &&
      Boolean(settings.openAiApiKeyEncrypted)
  };
}

export async function saveOpenAiApiKey(
  apiKey: string
): Promise<AiSettingsStatus> {
  const normalized = apiKey.trim();

  if (!normalized) {
    sessionApiKey = null;
    const settings = await readSettings();
    delete settings.openAiApiKeyEncrypted;
    await writeSettings(settings);
    return { configured: false, persistedSecurely: false };
  }

  sessionApiKey = normalized;

  if (!safeStorage.isEncryptionAvailable()) {
    return { configured: true, persistedSecurely: false };
  }

  const settings = await readSettings();
  settings.openAiApiKeyEncrypted = safeStorage
    .encryptString(normalized)
    .toString("base64");
  await writeSettings(settings);

  return { configured: true, persistedSecurely: true };
}


async function getEncryptedSecret(
  sessionValue: string | null,
  environmentName: string,
  settingsKey: "replicateApiTokenEncrypted" | "elevenLabsApiKeyEncrypted"
): Promise<string | null> {
  if (sessionValue) return sessionValue;
  const environmentValue = process.env[environmentName]?.trim();
  if (environmentValue) return environmentValue;
  if (!safeStorage.isEncryptionAvailable()) return null;
  const settings = await readSettings();
  const encrypted = settings[settingsKey];
  if (!encrypted) return null;
  try { return safeStorage.decryptString(Buffer.from(encrypted, "base64")); } catch { return null; }
}

async function saveEncryptedSecret(
  value: string,
  settingsKey: "replicateApiTokenEncrypted" | "elevenLabsApiKeyEncrypted"
): Promise<boolean> {
  if (!safeStorage.isEncryptionAvailable()) return false;
  const settings = await readSettings();
  if (!value) delete settings[settingsKey];
  else settings[settingsKey] = safeStorage.encryptString(value).toString("base64");
  await writeSettings(settings);
  return Boolean(value);
}

export async function getReplicateApiToken() {
  return getEncryptedSecret(sessionReplicateToken, "REPLICATE_API_TOKEN", "replicateApiTokenEncrypted");
}

export async function saveReplicateApiToken(value: string) {
  sessionReplicateToken = value.trim() || null;
  return saveEncryptedSecret(value.trim(), "replicateApiTokenEncrypted");
}

export async function getElevenLabsApiKey() {
  return getEncryptedSecret(sessionElevenLabsKey, "ELEVENLABS_API_KEY", "elevenLabsApiKeyEncrypted");
}

export async function saveElevenLabsApiKey(value: string) {
  sessionElevenLabsKey = value.trim() || null;
  return saveEncryptedSecret(value.trim(), "elevenLabsApiKeyEncrypted");
}
