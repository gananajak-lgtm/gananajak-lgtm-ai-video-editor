import { useEffect, useState } from "react";
import type {
  QcPackProgress,
  QcPackResult,
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

export default function EpisodeQcPackPanel({
  plan,
  disabled = false
}: Props) {
  const [sampleDuration, setSampleDuration] = useState(15);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<QcPackProgress | null>(null);
  const [result, setResult] = useState<QcPackResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return window.videoEditor.onQcPackProgress((next) => {
      if (running) setProgress(next);
    });
  }, [running]);

  const buildPack = async () => {
    setRunning(true);
    setProgress(null);
    setResult(null);
    setError(null);

    try {
      const next = await window.videoEditor.renderQcPack(
        plan,
        sampleDuration
      );
      if (next) setResult(next);
    } catch (buildError) {
      setError(
        buildError instanceof Error
          ? buildError.message
          : String(buildError)
      );
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="qcPackPanel">
      <div className="qcPackHeader">
        <div>
          <p className="eyebrow">EPISODE QC PACK</p>
          <h3>Check the opening, middle, and ending in one pass</h3>
          <p className="muted">
            The editor renders small Draft-quality samples from three points in
            the episode, saves them together, writes a QC manifest, and opens
            the destination folder when finished.
          </p>
        </div>

        <button
          className="primary"
          disabled={disabled || running}
          onClick={buildPack}
        >
          {running
            ? `Building ${Math.round((progress?.overallProgress ?? 0) * 100)}%...`
            : "Generate QC pack"}
        </button>
      </div>

      <div className="qcPackControls">
        <label>
          Sample length
          <select
            value={sampleDuration}
            onChange={(event) =>
              setSampleDuration(Number(event.target.value))
            }
          >
            <option value={10}>10 seconds each</option>
            <option value={15}>15 seconds each</option>
            <option value={20}>20 seconds each</option>
            <option value={30}>30 seconds each</option>
          </select>
        </label>

        <span>
          Up to 3 samples · Opening / Middle / Ending
        </span>
      </div>

      {running && progress && (
        <div className="qcPackProgressWrap">
          <div className="qcPackProgressMeta">
            <strong>
              {progress.label} · sample {progress.sampleIndex + 1}/
              {progress.totalSamples}
            </strong>
            <span>
              {Math.round(progress.sampleProgress * 100)}% sample ·{" "}
              {Math.round(progress.overallProgress * 100)}% overall
            </span>
          </div>
          <div className="qcPackProgress">
            <div
              style={{
                width: `${Math.max(
                  1,
                  Math.min(100, progress.overallProgress * 100)
                )}%`
              }}
            />
          </div>
        </div>
      )}

      {result && (
        <div className="qcPackResult">
          <strong>{result.samples.length} QC previews created</strong>
          <span>{result.folderPath}</span>
          <div className="qcPackSamples">
            {result.samples.map((sample) => (
              <div key={sample.id}>
                <strong>{sample.label}</strong>
                <span>
                  {formatTime(sample.start)} · {sample.duration.toFixed(1)}s
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <div className="brainError">{error}</div>}
    </section>
  );
}
