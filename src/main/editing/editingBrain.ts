import type {
  AudioAsset,
  EditingBrainPlan,
  TranscriptResult
} from "../../shared/types";
import { groupTranscriptIntoScenes } from "./sceneGrouper";
import { planSoundEffects } from "./sfxPlanner";

export function buildEditingBrainPlan(
  transcript: TranscriptResult,
  sfxLibrary: AudioAsset[]
): EditingBrainPlan {
  const scenes = groupTranscriptIntoScenes(transcript);
  const soundEffects = planSoundEffects(transcript, sfxLibrary);

  return {
    scenes,
    sfxCues: soundEffects.cues,
    automaticAudioLayers: soundEffects.layers
  };
}
