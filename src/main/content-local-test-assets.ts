import { mkdir } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import type { ContentProject, GeneratedAsset } from "../shared/content-factory";

function runFfmpeg(args: string[], label: string) {
  return new Promise<void>((resolve, reject) => {
    const proc = spawn(ffmpegPath || "ffmpeg", args);
    proc.once("error", reject);
    proc.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`${label} failed (${code})`)));
  });
}

export async function generateLocalTestAssets(project: ContentProject, root: string): Promise<ContentProject> {
  await mkdir(root, { recursive: true });
  const assets: GeneratedAsset[] = [];
  for (const scene of project.scenes) {
    const imagePath = path.join(root, `scene-${scene.order}.png`);
    const audioPath = path.join(root, `scene-${scene.order}.wav`);
    const seconds = Math.max(2.5, scene.estimatedDuration);
    await runFfmpeg(["-y","-f","lavfi","-i","color=c=0x182033:s=1080x1920:r=30","-frames:v","1",imagePath], "Local placeholder image");
    await runFfmpeg(["-y","-f","lavfi","-i","anullsrc=r=44100:cl=stereo","-t",String(seconds),audioPath], "Local test audio");
    assets.push(
      { id:`local-image-${scene.id}`, projectId:project.id, sceneId:scene.id, kind:"image", filePath:imagePath, provider:"local-test", mimeType:"image/png", source:"generated" },
      { id:`local-voice-${scene.id}`, projectId:project.id, sceneId:scene.id, kind:"voice", filePath:audioPath, provider:"local-test-silence", mimeType:"audio/wav", duration:seconds, source:"generated" }
    );
  }
  const now = new Date().toISOString();
  const jobs = assets.map((asset) => ({ id:`job-${asset.id}`, projectId:project.id, sceneId:asset.sceneId, kind:asset.kind, prompt:"Local test placeholder", status:"succeeded" as const, attempts:1, outputAssetId:asset.id, createdAt:now, updatedAt:now }));
  return { ...project, assetPlan:{ projectId:project.id, jobs, assets }, updatedAt:now };
}
