import { app, safeStorage } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import type { AiSettingsStatus } from "../shared/types";

type PersistedSettings = {
  openAiApiKeyEncrypted?: string;
  replicateApiTokenEncrypted?: string;
  elevenLabsApiKeyEncrypted?: string;
  elevenLabsWorkspaces?: Array<{ id: string; name: string; encryptedKey: string }>;
  activeElevenLabsWorkspaceId?: string;
  replicateVideoModel?: string;
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

export async function listElevenLabsWorkspaces() {
  const settings = await readSettings();
  const entries = settings.elevenLabsWorkspaces ?? [];
  return { activeId: settings.activeElevenLabsWorkspaceId ?? "legacy", workspaces: [
    ...(settings.elevenLabsApiKeyEncrypted || sessionElevenLabsKey || process.env.ELEVENLABS_API_KEY ? [{ id: "legacy", name: "Workspace หลัก", configured: true }] : []),
    ...entries.map(({ id, name }) => ({ id, name, configured: true }))
  ] };
}

export async function saveElevenLabsWorkspace(name: string, apiKey: string) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error("เครื่องนี้ยังไม่รองรับการเข้ารหัส API Key จึงไม่บันทึกคีย์แบบถาวร");
  const normalizedName = name.trim(), normalizedKey = apiKey.trim();
  if (!normalizedName || normalizedName.length > 80 || !normalizedKey || normalizedKey.length > 500) throw new Error("ชื่อ Workspace หรือ API Key ไม่ถูกต้อง");
  const settings = await readSettings();
  const id = `elevenlabs-${crypto.randomUUID()}`;
  settings.elevenLabsWorkspaces = [...(settings.elevenLabsWorkspaces ?? []), { id, name: normalizedName, encryptedKey: safeStorage.encryptString(normalizedKey).toString("base64") }];
  settings.activeElevenLabsWorkspaceId = id;
  await writeSettings(settings);
  return listElevenLabsWorkspaces();
}

export async function selectElevenLabsWorkspace(id: string) {
  const settings = await readSettings();
  if (id !== "legacy" && !(settings.elevenLabsWorkspaces ?? []).some(item => item.id === id)) throw new Error("ไม่พบ Workspace");
  if (id === "legacy" && !await getEncryptedSecret(sessionElevenLabsKey, "ELEVENLABS_API_KEY", "elevenLabsApiKeyEncrypted")) throw new Error("Workspace หลักยังไม่มี API Key");
  settings.activeElevenLabsWorkspaceId = id;
  await writeSettings(settings);
  return listElevenLabsWorkspaces();
}

export async function getElevenLabsApiKey() {
  const settings = await readSettings();
  const active = settings.activeElevenLabsWorkspaceId;
  if (active && active !== "legacy") {
    const entry = settings.elevenLabsWorkspaces?.find(item => item.id === active);
    if (!entry || !safeStorage.isEncryptionAvailable()) return null;
    try { return safeStorage.decryptString(Buffer.from(entry.encryptedKey, "base64")); } catch { return null; }
  }
  return getEncryptedSecret(sessionElevenLabsKey, "ELEVENLABS_API_KEY", "elevenLabsApiKeyEncrypted");
}

export async function saveElevenLabsApiKey(value: string) {
  sessionElevenLabsKey = value.trim() || null;
  const saved = await saveEncryptedSecret(value.trim(), "elevenLabsApiKeyEncrypted");
  const settings = await readSettings();
  settings.activeElevenLabsWorkspaceId = "legacy";
  await writeSettings(settings);
  return saved;
}

export async function getReplicateVideoModel(): Promise<string | null> {
  const fromEnvironment=process.env.REPLICATE_VIDEO_MODEL?.trim();
  if(fromEnvironment) return fromEnvironment;
  const settings=await readSettings();
  return settings.replicateVideoModel?.trim() || null;
}

export async function saveReplicateVideoModel(value:string): Promise<string | null> {
  const normalized=value.trim();
  const settings=await readSettings();
  if(normalized) settings.replicateVideoModel=normalized;
  else delete settings.replicateVideoModel;
  await writeSettings(settings);
  return normalized || null;
}
