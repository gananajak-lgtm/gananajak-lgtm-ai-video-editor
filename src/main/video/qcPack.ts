import fs from "node:fs/promises";
import path from "node:path";
import type {
  QcPackProgress,
  QcPackResult,
  QcSample,
  TimelinePlan
} from "../../shared/types";
import { createPreviewTimeline } from "./previewPlan";
import { renderTimeline } from "./render";

type QcSampleSpec = {
  id: string;
  label: string;
  start: number;
  duration: number;
};

function safeDuration(value: number) {
  return Math.max(5, Math.min(60, Math.round(value || 15)));
}

export function buildQcSampleSpecs(
  plan: TimelinePlan,
  requestedDuration = 15
): QcSampleSpec[] {
  const sampleDuration = Math.min(
    safeDuration(requestedDuration),
    Math.max(1, plan.duration)
  );

  if (plan.duration <= sampleDuration * 1.4) {
    return [
      {
        id: "full",
        label: "Full short episode",
        start: 0,
        duration: plan.duration
      }
    ];
  }

  const starts = [
    { id: "opening", label: "Opening", start: 0 },
    {
      id: "middle",
      label: "Middle",
      start: Math.max(0, plan.duration / 2 - sampleDuration / 2)
    },
    {
      id: "ending",
      label: "Ending",
      start: Math.max(0, plan.duration - sampleDuration)
    }
  ];

  const result: QcSampleSpec[] = [];
  for (const item of starts) {
    if (
      result.some(
        (existing) => Math.abs(existing.start - item.start) < sampleDuration * 0.5
      )
    ) {
      continue;
    }

    result.push({
      ...item,
      duration: Math.min(sampleDuration, plan.duration - item.start)
    });
  }

  return result;
}

function fileName(index: number, sample: QcSampleSpec) {
  return `QC-${String(index + 1).padStart(2, "0")}-${sample.id}.mp4`;
}

export async function renderQcPack(
  plan: TimelinePlan,
  folderPath: string,
  requestedDuration = 15,
  onProgress?: (progress: QcPackProgress) => void
): Promise<QcPackResult> {
  const specs = buildQcSampleSpecs(plan, requestedDuration);
  const samples: QcSample[] = [];

  await fs.mkdir(folderPath, { recursive: true });

  for (const [index, spec] of specs.entries()) {
    const previewPlan = createPreviewTimeline(
      plan,
      spec.start,
      spec.duration
    );
    const outputPath = path.join(folderPath, fileName(index, spec));

    await renderTimeline(previewPlan, outputPath, (progress) => {
      const overallProgress =
        (index + progress.progress) / Math.max(1, specs.length);

      onProgress?.({
        sampleIndex: index,
        totalSamples: specs.length,
        label: spec.label,
        sampleProgress: progress.progress,
        overallProgress
      });
    });

    samples.push({
      id: spec.id,
      label: spec.label,
      start: spec.start,
      duration: previewPlan.duration,
      outputPath
    });
  }

  const manifestPath = path.join(folderPath, "QC-pack.json");
  await fs.writeFile(
    manifestPath,
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        sourceDuration: plan.duration,
        width: plan.width,
        height: plan.height,
        fps: plan.fps,
        samples
      },
      null,
      2
    ),
    "utf8"
  );

  return { folderPath, samples };
}
