import type { AssetJob, AssetPlan, ContentProject } from "../shared/content-factory";

export type AssetPlanningOptions = {
  includeVideo?: boolean;
  includeVoice?: boolean;
  includeSfx?: boolean;
};

function makeJob(
  projectId: string,
  sceneId: string,
  kind: AssetJob["kind"],
  prompt: string,
  index: number
): AssetJob {
  const now = new Date().toISOString();
  return {
    id: `${projectId}-${sceneId}-${kind}-${index}`,
    projectId,
    sceneId,
    kind,
    prompt,
    status: "queued",
    attempts: 0,
    createdAt: now,
    updatedAt: now
  };
}

export function buildAssetPlan(
  project: ContentProject,
  options: AssetPlanningOptions = {}
): AssetPlan {
  const includeVoice = options.includeVoice ?? true;
  // SFX stays optional until a provider/library is configured. Missing ambience must not block a render.
  const includeSfx = options.includeSfx ?? false;
  // Video is a manual Meta AI workflow by default. Keep jobs in the plan so each scene can accept a Meta clip.
  const includeVideo = options.includeVideo ?? true;
  const jobs: AssetJob[] = [];

  for (const scene of project.scenes) {
    jobs.push(makeJob(project.id, scene.id, "image", scene.imagePrompt, jobs.length + 1));

    if (includeVideo && scene.videoPrompt) {
      jobs.push(makeJob(project.id, scene.id, "video", scene.videoPrompt, jobs.length + 1));
    }

    if (includeVoice) {
      jobs.push(makeJob(project.id, scene.id, "voice", scene.narration, jobs.length + 1));
    }

    if (includeSfx) {
      for (const hint of scene.sfxHints) {
        jobs.push(makeJob(project.id, scene.id, "sfx", hint, jobs.length + 1));
      }
    }
  }

  return { projectId: project.id, jobs, assets: [] };
}
