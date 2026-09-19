import type {
  FullEpisodeTestReport
} from "../shared/types";

type Props = {
  history: FullEpisodeTestReport[];
};

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function formatTime(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) return "n/a";
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const remainder = safe - minutes * 60;
  return `${String(minutes).padStart(2, "0")}:${remainder
    .toFixed(2)
    .padStart(5, "0")}`;
}

function fileName(filePath: string) {
  return filePath.split(/[\\/]/).pop() ?? filePath;
}

export default function FullEpisodeTestPanel({ history }: Props) {
  if (history.length === 0) {
    return (
      <section className="fullEpisodeTestPanel">
        <div>
          <p className="eyebrow">FULL EPISODE TEST</p>
          <h3>Post-render verification will appear here</h3>
          <p className="muted">
            After a full MP4 export, the editor probes the actual output and
            records duration, file size, resolution, FPS, codecs, frame count,
            and audio/video timing. A JSON report is saved beside the MP4.
          </p>
        </div>
      </section>
    );
  }

  const latest = history[0];

  return (
    <section className="fullEpisodeTestPanel">
      <div className="fullEpisodeTestHeader">
        <div>
          <p className="eyebrow">FULL EPISODE TEST</p>
          <h3>Verify the exported MP4, not just the timeline plan</h3>
          <p className="muted">
            Every full export is checked with FFprobe and stored in this project
            so different render rounds can be compared.
          </p>
        </div>

        <span
          className={
            latest.passed
              ? "fullTestBadge fullTestPass"
              : "fullTestBadge fullTestFail"
          }
        >
          {latest.passed ? "Latest export passed" : "Latest export needs review"}
        </span>
      </div>

      <div className="fullTestStats">
        <span>{latest.width ?? "?"}×{latest.height ?? "?"}</span>
        <span>{latest.fps?.toFixed(2) ?? "?"} fps</span>
        <span>{formatBytes(latest.fileSizeBytes)}</span>
        <span>{latest.frameCount?.toLocaleString() ?? "n/a"} frames</span>
        <span>duration Δ {latest.durationDelta.toFixed(3)}s</span>
        <span>
          A/V Δ {latest.avSyncDelta === null ? "n/a" : `${latest.avSyncDelta.toFixed(3)}s`}
        </span>
      </div>

      <div className="fullTestLatest">
        <div>
          <strong>{fileName(latest.outputPath)}</strong>
          <small>
            {formatTime(latest.actualDuration)} actual ·{" "}
            {formatTime(latest.expectedDuration)} expected
          </small>
        </div>
        <div>
          <strong>
            {latest.videoCodec ?? "unknown video"} +{" "}
            {latest.audioCodec ?? "unknown audio"}
          </strong>
          <small title={latest.reportPath}>
            Report: {fileName(latest.reportPath)}
          </small>
        </div>
      </div>

      <div className="fullTestDiagnostics">
        {latest.diagnostics.map((item) => (
          <div
            className={`fullTestDiagnostic fullTest-${item.level}`}
            key={item.id}
          >
            <strong>{item.level.toUpperCase()}</strong>
            <p>{item.message}</p>
          </div>
        ))}
      </div>

      {history.length > 1 && (
        <div className="fullTestHistory">
          <div className="manualSectionTitle">
            <strong>Recent export tests</strong>
            <small>Newest first · saved with the project</small>
          </div>

          {history.slice(0, 8).map((report) => (
            <div className="fullTestHistoryRow" key={report.id}>
              <span className={report.passed ? "historyPass" : "historyFail"}>
                {report.passed ? "PASS" : "CHECK"}
              </span>
              <div>
                <strong>{fileName(report.outputPath)}</strong>
                <small>
                  {new Date(report.createdAt).toLocaleString()} ·{" "}
                  {formatBytes(report.fileSizeBytes)} · Δ{" "}
                  {report.durationDelta.toFixed(3)}s
                </small>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
