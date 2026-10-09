# Voice Studio integration contract

Voice Studio can be prepared without configuring OpenAI or ElevenLabs. The renderer exports two distinct JSON artifacts:

- `voice-studio-plan.json`: editable script, speaker and emotion annotations, and speaker-to-ElevenLabs voice IDs.
- `voice-production-queue.json`: ordered synthesis jobs and separate SFX cues. Jobs are never sent to providers by the offline planner.

## Intended production workflow

1. Import or paste an episode. Preserve original text and provide manual correction of any uncertain speaker.
2. Map each character and narrator to an ElevenLabs voice ID. Reuse mappings across episodes.
3. Review each segment. Export only when no lines are blocked.
4. Once the API bridge is implemented, display exact character count, chosen model and provider-estimated cost before a user explicitly approves any paid synthesis.
5. Synthesize selected lines only. Persist successful output paths, provider request IDs, timestamps and a fingerprint based on text + emotion + voice + model/settings. Reuse output if fingerprint and file both match.
6. Fail or cancel individual jobs without discarding successful jobs. Never silently retry paid requests when the response is ambiguous; first reconcile provider status.
7. Preview individual results, allow per-line regeneration and export a manifest suitable for timeline assembly.

## Safety and correctness constraints

- Store API keys only in the existing Electron main-process secure settings store; never include keys in JSON exports or renderer localStorage.
- Do not trust imported JSON or model-generated speaker labels. Validate structure and file paths at the main-process IPC boundary.
- Do not infer that the previous speaker continues speaking without flagging that line for review.
- Treat SFX as metadata rather than text to synthesize.
- Preserve stable order and the unmodified source separately for no-loss verification before synthesis.
- API work, audio-file writes, cancellation, retry reconciliation, and timeline integration remain future implementation tasks. The offline queue does not represent completed synthesis.

## Current implementation

`src/renderer/novel-voice-parser.ts` — heuristic Thai script parser.

`src/renderer/VoiceStudioPanel.tsx` — editor, speaker correction, saved plan import/export, local system speech preview, approval gate.

`src/renderer/voice-production-plan.ts` — deterministic offline job planning and readiness summary.

No paid synthesis is initiated by these modules.

## Multiple authorized ElevenLabs workspaces

The app may maintain multiple **authorized workspace profiles** and multiple scoped API keys. Profiles are not additional free-credit pools. ElevenLabs API keys count against their workspace quota. Users choose a specific workspace before submitting each job; no automatic key or account rotation, failover on quota exhaustion, or combining free trial allowances.

Profile metadata includes an opaque key reference, display name, workspace label, enabled flag, explicit budget and last known usage, and workspace-specific character voice IDs. The renderer never receives the secret key. A missing or stale usage figure blocks paid scheduling until refreshed, and estimates are not authoritative provider balances. The production queue must include a selected profile ID and resolved voice ID when the future API bridge is built.

`src/renderer/elevenlabs-workspace-profiles.ts` provides the pure selection and budget checks. Secure multi-key storage, account verification, usage refresh, UI configuration, and provider calls are **not implemented yet**. API keys should be restricted to needed endpoints and configured with provider-side credit limits.
