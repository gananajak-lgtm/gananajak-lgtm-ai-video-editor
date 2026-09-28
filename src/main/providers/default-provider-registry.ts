import { AssetProviderRegistry } from "../content-asset-provider";
import { ReplicateImageProvider } from "./replicate-image-provider";
import { ElevenLabsVoiceProvider } from "./elevenlabs-voice-provider";
import { ReplicateReferenceVideoProvider } from "./replicate-reference-video-provider";

export function createDefaultAssetProviderRegistry(videoModel?:string|null) {
  return new AssetProviderRegistry([
    new ReplicateImageProvider(),
    new ReplicateReferenceVideoProvider(videoModel ?? undefined),
    new ElevenLabsVoiceProvider()
  ]);
}
