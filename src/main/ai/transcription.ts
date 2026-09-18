import { app } from "electron";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import type { TranscriptResult, TranscriptSegment } from "../../shared/types";
import { getOpenAiApiKey } from "../settings";
import { probeDuration } from "../video/probe";

const CHUNK_SECONDS = 10 * 60;

type WhisperSegment = {
  start: number;
  end: number;
  text: string;
};

type WhisperVerboseResponse = {
  text?: string;
  language?: string;
  duration?: number;
  segments?: WhisperSegment[];
  error?: {
    message?: string;
  };
};

function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    if (!ffmpegPath) {
      reject(new Error("Bundled FFmpeg binary is unavailable."));
      return;
    }

    const process = spawn(ffmpegPath, args);
    let stderr = "";

    process.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 12000) stderr = stderr.slice(-12000);
    });

    process.on("error", reject);
    process.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `FFmpeg exited with code ${code}.`));
    });
  });
}

async function createAudioChunk(
  inputPath: string,
  outputPath: string,
  start: number,
  duration: number
) {
  await runFfmpeg([
    "-y",
    "-ss",
    start.toFixed(3),
    "-t",
    duration.toFixed(3),
    "-i",
    inputPath,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-c:a",
    "libmp3lame",
    "-b:a",
    "64k",
    outputPath
  ]);
}

async function transcribeChunk(
  chunkPath: string,
  apiKey: string
): Promise<WhisperVerboseResponse> {
  const audio = await fs.readFile(chunkPath);
  const form = new FormData();

  form.append(
    "file",
    new Blob([new Uint8Array(audio)]),
    path.basename(chunkPath)
  );
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");
  form.append("temperature", "0");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    body: form
  });

  const result = (await response.json()) as WhisperVerboseResponse;

  if (!response.ok) {
    throw new Error(
      result.error?.message ||
        `Transcription request failed with HTTP ${response.status}.`
    );
  }

  return result;
}

export async function transcribeLongNarration(
  narrationPath: string
): Promise<TranscriptResult> {
  const apiKey = await getOpenAiApiKey();
  if (!apiKey) {
    throw new Error(
      "AI transcription is not configured. Add an OpenAI API key in AI Audio Brain settings."
    );
  }

  const totalDuration = await probeDuration(narrationPath);
  const tempRoot = await fs.mkdtemp(
    path.join(app.getPath("temp") || os.tmpdir(), "ai-video-editor-transcribe-")
  );

  const transcriptSegments: TranscriptSegment[] = [];
  const transcriptText: string[] = [];
  let language: string | null = null;

  try {
    let chunkIndex = 0;

    for (let offset = 0; offset < totalDuration; offset += CHUNK_SECONDS) {
      const duration = Math.min(CHUNK_SECONDS, totalDuration - offset);
      const chunkPath = path.join(
        tempRoot,
        `chunk-${String(chunkIndex + 1).padStart(3, "0")}.mp3`
      );

      await createAudioChunk(narrationPath, chunkPath, offset, duration);
      const result = await transcribeChunk(chunkPath, apiKey);

      if (!language && result.language) language = result.language;
      if (result.text?.trim()) transcriptText.push(result.text.trim());

      for (const segment of result.segments ?? []) {
        const text = segment.text.trim();
        if (!text) continue;

        transcriptSegments.push({
          id: `segment-${transcriptSegments.length + 1}`,
          start: offset + segment.start,
          end: offset + segment.end,
          text
        });
      }

      chunkIndex += 1;
    }

    return {
      provider: "openai-whisper-1",
      language,
      duration: totalDuration,
      text: transcriptText.join(" ").trim(),
      segments: transcriptSegments
    };
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}
