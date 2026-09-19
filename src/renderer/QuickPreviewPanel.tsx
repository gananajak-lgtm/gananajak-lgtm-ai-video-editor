import { useEffect, useMemo, useState } from "react";
import type {
  RenderProgress,
  TimelinePlan
} from "../shared/types";

type Props = {
  plan: TimelinePlan;
  disabled?: boolean;
};

function formatTime(seconds: number) {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const remainder = safe - minutes * 60;
  return `${String(minutes).padStart(2, "0")}:${remainder
    .toFixed(1)
    .padStart(4, "0")}`;
}

export default function QuickPreviewPanel({
  plan,
  disabled = false
}: Props) {
  const [start, setStart] = useState(0);
  const [duration, setDuration] = useState(20);
  const [previewing, setPreviewing] = useState(false);
  const [progress, setProgress] = useState<RenderProgress | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const maxStart = Math.max(0, plan.duration - 1);
  const effectiveDuration = useMemo(
    () => Math.min(duration, Math.max(1, plan.duration - start)),
    [duration, plan.duration, start]
  );

  useEffect(() => {
    setStart((current) => Math.min(current, maxStart));
  }, [maxStart]);

  useEffect(() => {
    return window.videoEditor.onRenderProgress((next) => {
      if (previewing) setProgress(next);
    });
  }, [previewing]);

  const renderPreview = async () => {
    setPreviewing(true);
    setProgress({
      progress: 0,
      elapsed: 0,
      duration: effectiveDuration
    });
    setMessage(null);

    try {
      const result = await window.videoEditor.renderPreview(
        plan,
        start,
        effectiveDuration
      );
      setMessage(`Preview opened: ${result.outputPath}`);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : String(error)
      );
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <section className="quickPreviewPanel">
      <div className="quickPreviewHeader">
        <div>
          <p className="eyebrow">QUICK PREVIEW</p>
          <h3>Render only the part you want to inspect</h3>
          <p className="muted">
            Preview uses Draft quality, caps the longest side at 960 px, and
            limits frame rate to 30 fps. It keeps the real narration position,
            subtitles, overlapping SFX, camera motion, and transitions.
          </p>
        </div>

        <button
          className="primary"
          disabled={disabled || previewing}
          onClick={renderPreview}
        >
          {previewing
            ? `Rendering ${Math.round((progress?.progress ?? 0) * 100)}%...`
            : "Render preview"}
        </button>
      </div>

      <div className="quickPreviewControls">
        <label>
          Start
          <input
            type="range"
            min="0"
            max={Math.max(1, maxStart)}
            step="0.5"
            value={Math.min(start, Math.max(1, maxStart))}
            onChange={(event) => setStart(Number(event.target.value))}
          />
          <strong>{formatTime(start)}</strong>
        </label>

        <label>
          Preview length
          <select
            value={duration}
            onChange={(event) => setDuration(Number(event.target.value))}
          >
            <option value={10}>10 seconds</option>
            <option value={20}>20 seconds</option>
            <option value={30}>30 seconds</option>
            <option value={60}>60 seconds</option>
          </select>
        </label>

        <div className="quickPreviewRange">
          <span>Range</span>
          <strong>
            {formatTime(start)} → {formatTime(start + effectiveDuration)}
          </strong>
        </div>
      </div>

      {previewing && progress && (
        <div className="quickPreviewProgress">
          <div
            style={{
              width: `${Math.max(
                1,
                Math.min(100, progress.progress * 100)
              )}%`
            }}
          />
        </div>
      )}

      {message && (
        <p className="timelineHint">{message}</p>
      )}
    </section>
  );
}
