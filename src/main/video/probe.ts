import { spawn } from "node:child_process";
import ffprobeStatic from "ffprobe-static";

export function probeDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const process = spawn(ffprobeStatic.path, [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filePath
    ]);

    let stdout = "";
    let stderr = "";

    process.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    process.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    process.on("error", reject);

    process.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || "Unable to read narration duration."));
        return;
      }

      const duration = Number.parseFloat(stdout.trim());
      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new Error("Narration duration is invalid."));
        return;
      }

      resolve(duration);
    });
  });
}
