import { app, safeStorage } from "electron";
import fs from "node:fs/promises";
import path from "node:path";

type PersistedSettings = {
  openAiApiKeyEncrypted?: string;
};

let sessionApiKey: string | null = null;

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

export async function hasOpenAiApiKey() {
  return Boolean(await getOpenAiApiKey());
}

export async function saveOpenAiApiKey(apiKey: string) {
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
