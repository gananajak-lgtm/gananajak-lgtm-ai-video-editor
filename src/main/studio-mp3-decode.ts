import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";

export type Mp3DecodeResult = { valid: true } | { valid: false; reason: string };

/** Decode the entire stream and retain safe FFmpeg diagnostics for failed paid generations. */
export async function checkMp3Decoding(filePath: string): Promise<Mp3DecodeResult> {
  if (typeof ffmpegPath !== "string" || !ffmpegPath) {
    return { valid: false, reason: "FFmpeg executable is unavailable" };
  }
  return new Promise(resolve => {
    let settled = false;
    let stderr = "";
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(ffmpegPath, [
        "-hide_banner", "-nostdin", "-v", "error", "-xerror",
        "-i", filePath, "-map", "0:a:0", "-f", "null", "-"
      ], { stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
    } catch (error) {
      resolve({ valid: false, reason: `FFmpeg launch failed: ${error instanceof Error ? error.message : String(error)}` });
      return;
    }
    const finish = (result: Mp3DecodeResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(result);
    };
    child.stderr?.on("data", chunk => {
      if (stderr.length < 2048) stderr += String(chunk).slice(0, 2048 - stderr.length);
    });
    const timeout = setTimeout(() => {
      child.kill();
      finish({ valid: false, reason: "FFmpeg decode timed out after 30 seconds" });
    }, 30000);
    child.on("error", error => finish({ valid: false, reason: `FFmpeg launch failed (${(error as NodeJS.ErrnoException).code ?? "unknown"}): ${error.message}` }));
    child.on("close", code => finish(code === 0
      ? { valid: true }
      : { valid: false, reason: `FFmpeg exited with code ${code ?? "unknown"}: ${stderr.trim().slice(0, 350) || "no diagnostic output"}` }));
  });
}

/** Backwards-compatible boolean check for existing callers and tests. */
export async function isDecodableMp3(filePath: string): Promise<boolean> {
  return (await checkMp3Decoding(filePath)).valid;
}
