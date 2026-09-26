import { AssetProviderRegistry } from "../content-asset-provider";
import { ReplicateImageProvider } from "./replicate-image-provider";
import { ElevenLabsVoiceProvider } from "./elevenlabs-voice-provider";

export function createDefaultAssetProviderRegistry() {
  return new AssetProviderRegistry([
    new ReplicateImageProvider(),
    new ElevenLabsVoiceProvider()
  ]);
}
