import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ContentProject } from "../shared/content-factory";
import { buildNarrationAssemblyPlan, buildFfmpegConcatManifest, buildNarrationConcatArgs } from "./content-narration-assembly";
import { bridgeGeneratedAssets, buildGeneratedTimeline } from "./content-timeline-bridge";

export type NarrationAssemblyResult = {
  narrationPath: string;
  timeline: ReturnType<typeof buildGeneratedTimeline>;
};

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.once("error", reject);
    child.once("close", (code) => code === 0 ? resolve() : reject(new Error(`FFmpeg narration assembly failed (${code}): ${stderr.slice(-2000)}`)));
  });
}

export async function assembleNarrationAndTimeline(
  project: ContentProject,
  workDir: string,
  ffmpegCommand = process.env.FFMPEG_PATH?.trim() || "ffmpeg"
): Promise<NarrationAssemblyResult> {
  const bridge = bridgeGeneratedAssets(project);
  if (!bridge.readyForNarrationAssembly) {
    throw new Error("Cannot assemble narration until every scene has generated image and voice assets.");
  }

  await mkdir(workDir, { recursive: true });
  const manifestPath = path.join(workDir, `${project.id}-narration.txt`);
  const narrationPath = path.join(workDir, `${project.id}-narration.m4a`);
  const plan = buildNarrationAssemblyPlan(project, bridge.narrationSegments, narrationPath);
  await writeFile(manifestPath, buildFfmpegConcatManifest(plan), "utf8");

  try {
    await run(ffmpegCommand, buildNarrationConcatArgs(manifestPath, narrationPath));
  } finally {
    await rm(manifestPath, { force: true });
  }

  return {
    narrationPath,
    timeline: buildGeneratedTimeline(project, narrationPath)
  };
}
