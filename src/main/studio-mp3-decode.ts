import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";

/** Decode the entire MP3 stream before accepting a cached asset. No paid API calls. */
export async function isDecodableMp3(filePath: string): Promise<boolean> {
  if (typeof ffmpegPath !== "string" || !ffmpegPath) return false;
  return new Promise(resolve => {
    const child = spawn(ffmpegPath, [
      "-hide_banner", "-nostdin", "-v", "error", "-xerror",
      "-i", filePath, "-map", "0:a:0", "-f", "null", "-"
    ], { stdio: "ignore", windowsHide: true });
    let settled = false;
    const finish = (valid: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(valid);
    };
    const timeout = setTimeout(() => {
      child.kill();
      finish(false);
    }, 30000);
    child.on("error", () => finish(false));
    child.on("close", code => finish(code === 0));
  });
}
