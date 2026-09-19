import { useEffect, useState } from "react";
import type {
  RenderDiagnostics,
  TimelinePlan
} from "../shared/types";

type Props = {
  plan: TimelinePlan | null;
};

function formatTime(seconds: number) {
  const safe = Math.max(0, Math.round(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }

  return `${minutes}m ${secs}s`;
}

export default function EpisodeReadinessPanel({ plan }: Props) {
  const [diagnostics, setDiagnostics] =
    useState<RenderDiagnostics | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!plan) {
      setDiagnostics(null);
      return;
    }

    setChecking(true);
    void window.videoEditor
      .analyzeRenderPlan(plan)
      .then((result) => {
        if (!cancelled) setDiagnostics(result);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [plan]);

  if (!plan) return null;

  const warningCount =
    diagnostics?.diagnostics.filter((item) => item.level === "warning")
      .length ?? 0;
  const errorCount =
    diagnostics?.diagnostics.filter((item) => item.level === "error")
      .length ?? 0;

  return (
    <section className="episodeReadinessPanel">
      <div className="episodeReadinessHeader">
        <div>
          <p className="eyebrow">FULL EPISODE READINESS</p>
          <h3>Check the complete edit before a long render</h3>
          <p className="muted">
            This checks timeline structure, total runtime, subtitle bounds,
            audio-layer load, frame count, and heavy export combinations before
            FFmpeg starts chewing through the episode.
          </p>
        </div>

        <span
          className={
            errorCount > 0
              ? "readinessBadge readinessError"
              : warningCount > 0
                ? "readinessBadge readinessWarning"
                : "readinessBadge readinessReady"
          }
        >
          {checking
            ? "Checking..."
            : errorCount > 0
              ? `${errorCount} blocking issue${errorCount === 1 ? "" : "s"}`
              : warningCount > 0
                ? `Ready with ${warningCount} warning${warningCount === 1 ? "" : "s"}`
                : "Ready to render"}
        </span>
      </div>

      {diagnostics && (
        <>
          <div className="readinessStats">
            <span>{diagnostics.clipCount} shots</span>
            <span>{diagnostics.subtitleCount} subtitles</span>
            <span>{diagnostics.audioLayerCount} extra audio layers</span>
            <span>{formatTime(diagnostics.duration)}</span>
            <span>
              {diagnostics.estimatedFrames.toLocaleString()} estimated frames
            </span>
            <span>
              {diagnostics.megapixelsPerFrame.toFixed(2)} MP / frame
            </span>
          </div>

          <div className="readinessDiagnostics">
            {diagnostics.diagnostics.map((item) => (
              <div
                className={`readinessItem readiness-${item.level}`}
                key={item.id}
              >
                <strong>{item.level.toUpperCase()}</strong>
                <p>{item.message}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
