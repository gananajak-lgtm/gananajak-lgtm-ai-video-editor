import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AssetJob, GeneratedAsset } from "../shared/content-factory";
import type { AssetGenerationContext, AssetProvider } from "./content-asset-provider";
import { getElevenLabsApiKey } from "../settings";
import { probeDuration } from "../video/probe";

export class ElevenLabsVoiceProvider implements AssetProvider {
  readonly id = "elevenlabs-voice";
  constructor(private readonly voiceId = process.env.ELEVENLABS_VOICE_ID?.trim() || "21m00Tcm4TlvDq8ikWAM") {}
  supports(kind: AssetJob["kind"]) { return kind === "voice"; }

  async generate(job: AssetJob, context: AssetGenerationContext): Promise<GeneratedAsset> {
    const apiKey = await getElevenLabsApiKey();
    if (!apiKey) throw new Error("ElevenLabs API key is not configured.");

    const modelId = process.env.ELEVENLABS_MODEL_ID?.trim() || "eleven_multilingual_v2";
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
    await writeFile(filePath, Buffer.from(await response.arrayBuffer()));
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
