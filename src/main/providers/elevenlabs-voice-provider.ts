import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { hasPlausibleMp3Header } from "../studio-mp3-header";
import { checkMp3Decoding, isDecodableMp3 } from "../studio-mp3-decode";
import path from "node:path";
import type { AssetJob, GeneratedAsset } from "../../shared/content-factory";
import type { AssetGenerationContext, AssetProvider } from "../content-asset-provider";
import { getElevenLabsApiKey } from "../settings";
import { probeDuration } from "../video/probe";

/**
 * Generate one explicitly approved dialogue line and persist its playable MP3
 * in the selected episode. This function is never called by preflight/tests.
 * Callers must require a fresh, explicit paid-generation confirmation.
 */
async function generateStudioVoiceLineUnchecked(
  projectId: string,
  episodeId: string,
  lineId: string,
  fingerprint: string,
  text: string,
  voiceId: string,
  modelId = "eleven_v4",
  metadata: { jobId?: string; speaker?: string; emotion?: string } = {}
): Promise<{ outputPath: string }> {
  if (!text.trim() || text.length > 5000 || !/^[a-zA-Z0-9_-]{1,100}$/.test(voiceId) ||
      !/^[a-zA-Z0-9_-]{1,100}$/.test(modelId)) {
    throw new Error("Invalid ElevenLabs voice generation request");
  }
  if (modelId !== "eleven_v3" && modelId !== "eleven_v4") throw new Error("Select Eleven v3 or Eleven v4 for Thai Studio voice generation");
  const { resolveStudioEpisodeVoiceOutput, registerStudioEpisodeVoiceAudio, loadStudioEpisodeVoiceAudio } = await import("../studio-projects");
  const destination = await resolveStudioEpisodeVoiceOutput(projectId, episodeId, lineId);
  const existing = (await loadStudioEpisodeVoiceAudio(projectId, episodeId))[lineId];
  if (existing?.fingerprint === fingerprint) return { outputPath: existing.outputPath };
  const apiKey = await getElevenLabsApiKey();
  if (!apiKey) throw new Error("ElevenLabs API key is not configured");
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({
      text, model_id: modelId,
      ...(modelId.startsWith("eleven_v3") || modelId.startsWith("eleven_v4") ? { language_code: "th" } : {}),
      voice_settings: { stability: 0.5, similarity_boost: 0.75 }
    })
  });
  if (!response.ok) throw new Error(`ElevenLabs speech generation failed: ${response.status} ${await response.text()}`);
  const audio = Buffer.from(await response.arrayBuffer());
  if (!hasPlausibleMp3Header(audio.subarray(0, 10))) throw new Error("ElevenLabs returned an invalid MP3 header");
  const temporaryPath = path.join(path.dirname(destination.absolutePath), `.${lineId}-${randomUUID()}.mp3`);
  try {
    await writeFile(temporaryPath, audio, { flag: "wx" });
    const decoded = await checkMp3Decoding(temporaryPath);
    if (!decoded.valid) throw new Error(`ElevenLabs MP3 validation failed: ${decoded.reason}`);
    await rename(temporaryPath, destination.absolutePath);
    await registerStudioEpisodeVoiceAudio(projectId, episodeId, lineId, fingerprint, destination.relativePath, { ...metadata, text });
    return { outputPath: destination.relativePath };
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

const studioVoiceRequests = new Map<string, Promise<{ outputPath: string }>>();
/** Coalesce concurrent requests for the same line to avoid double billing. */
export async function generateStudioVoiceLine(
  projectId: string, episodeId: string, lineId: string,
  fingerprint: string, text: string, voiceId: string,
  modelId = "eleven_v4",
  metadata: { jobId?: string; speaker?: string; emotion?: string } = {}
): Promise<{ outputPath: string }> {
  if (!projectId || !episodeId || !lineId || !fingerprint) throw new Error("Missing voice request identity");
  const key = JSON.stringify([projectId, episodeId, lineId]);
  const active = studioVoiceRequests.get(key);
  if (active) {
    throw new Error("Voice generation is already running for this line");
  }
  const request = generateStudioVoiceLineUnchecked(projectId, episodeId, lineId, fingerprint, text, voiceId, modelId, metadata);
  studioVoiceRequests.set(key, request);
  try { return await request; }
  finally { if (studioVoiceRequests.get(key) === request) studioVoiceRequests.delete(key); }
}

export class ElevenLabsVoiceProvider implements AssetProvider {
  readonly id = "elevenlabs-voice";
  constructor(private readonly voiceId = process.env.ELEVENLABS_VOICE_ID?.trim() || "21m00Tcm4TlvDq8ikWAM") {}
  supports(kind: AssetJob["kind"]) { return kind === "voice"; }

  async generate(job: AssetJob, context: AssetGenerationContext): Promise<GeneratedAsset> {
    const apiKey = await getElevenLabsApiKey();
    if (!apiKey) throw new Error("ElevenLabs API key is not configured.");

    const modelId = process.env.ELEVENLABS_MODEL_ID?.trim() || "eleven_v4";
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg"
      },
      body: JSON.stringify({
        text: job.prompt,
        model_id: modelId,
        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
      })
    });
    if (!response.ok) throw new Error(`ElevenLabs speech generation failed: ${response.status} ${await response.text()}`);

    await mkdir(context.workDir, { recursive: true });
    const filePath = path.join(context.workDir, `${job.id}.mp3`);
    // Do not expose a partial or corrupt MP3 to the editor's asset pipeline.
    const audio = Buffer.from(await response.arrayBuffer());
    if (!hasPlausibleMp3Header(audio.subarray(0, 10))) {
      throw new Error("ElevenLabs returned an invalid MP3 header.");
    }
    const temporaryPath = path.join(context.workDir, `.${job.id}-${randomUUID()}.mp3`);
    try {
      await writeFile(temporaryPath, audio, { flag: "wx" });
      if (!(await isDecodableMp3(temporaryPath))) {
        throw new Error("ElevenLabs returned an MP3 that could not be decoded.");
      }
      await rename(temporaryPath, filePath);
    } finally {
      await rm(temporaryPath, { force: true });
    }
    const duration = await probeDuration(filePath);
    return {
      id: `asset-${job.id}`,
      projectId: job.projectId,
      sceneId: job.sceneId,
      kind: "voice",
      filePath,
      provider: this.id,
      mimeType: "audio/mpeg",
      duration
    };
  }
}
