import { useMemo, useState } from "react";
import type { TimelinePlan } from "../shared/types";

function fileName(filePath: string) {
  return filePath.split(/[\\/]/).pop() ?? filePath;
}

function formatTime(seconds: number) {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const remainder = safe - minutes * 60;
  return `${String(minutes).padStart(2, "0")}:${remainder.toFixed(1).padStart(4, "0")}`;
}

export default function App() {
  const [images, setImages] = useState<string[]>([]);
  const [narration, setNarration] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TimelinePlan | null>(null);
  const [building, setBuilding] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ready = images.length > 0 && narration !== null;
  const summary = useMemo(() => {
    if (!images.length) return "No images selected";
    return images.length === 1 ? "1 image selected" : `${images.length} images selected`;
  }, [images]);

  const chooseImages = async () => {
    const picked = await window.videoEditor.selectImages();
    if (picked.length) {
      setImages(picked);
      setTimeline(null);
      setNotice(null);
      setError(null);
    }
  };

  const chooseNarration = async () => {
    const picked = await window.videoEditor.selectNarration();
    if (picked) {
      setNarration(picked);
      setTimeline(null);
      setNotice(null);
      setError(null);
    }
  };

  const buildTimeline = async () => {
    if (!narration || images.length === 0) return;

    setBuilding(true);
    setError(null);
    setNotice(null);

    try {
      const nextTimeline = await window.videoEditor.buildTimeline(images, narration);
      setTimeline(nextTimeline);
      setNotice(
        `Automatic timeline created: ${nextTimeline.clips.length} clips across ${formatTime(nextTimeline.duration)}.`
      );
    } catch (buildError) {
      setError(buildError instanceof Error ? buildError.message : String(buildError));
    } finally {
      setBuilding(false);
    }
  };

  const exportVideo = async () => {
    if (!timeline) return;

    const outputPath = await window.videoEditor.chooseOutput();
    if (!outputPath) return;

    setRendering(true);
    setError(null);
    setNotice("Rendering MP4 with FFmpeg...");

    try {
      const result = await window.videoEditor.renderTimeline(timeline, outputPath);
      setNotice(`Export complete: ${result.outputPath}`);
    } catch (renderError) {
      setError(renderError instanceof Error ? renderError.message : String(renderError));
      setNotice(null);
    } finally {
      setRendering(false);
    }
  };

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">GANANAJAK LAB</p>
          <h1>AI Video Editor</h1>
        </div>
        <div className="status">
          <span className="statusDot" />
          Phase 1 · First-cut engine
        </div>
      </header>

      <section className="hero">
        <div>
          <p className="kicker">Automatic story editing</p>
          <h2>Turn narration and still images into a first-cut video.</h2>
          <p className="lede">
            Add the story ingredients, generate a narration-length timeline, then export a cinematic MP4 with subtle motion.
          </p>
        </div>
        <div className="heroBadge">🎬</div>
      </section>

      <section className="grid">
        <article className="panel">
          <div className="panelHeader">
            <div>
              <span className="step">01</span>
              <h3>Story images</h3>
            </div>
            <button onClick={chooseImages}>Choose images</button>
          </div>
          <p className="muted">{summary}</p>
          <div className="mediaList">
            {images.slice(0, 8).map((image, index) => (
              <div className="mediaRow" key={image}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{fileName(image)}</strong>
              </div>
            ))}
            {images.length > 8 && (
              <div className="mediaRow more">+ {images.length - 8} more</div>
            )}
          </div>
        </article>

        <article className="panel">
          <div className="panelHeader">
            <div>
              <span className="step">02</span>
              <h3>Narration</h3>
            </div>
            <button onClick={chooseNarration}>Choose audio</button>
          </div>
          <p className="muted">
            {narration ? fileName(narration) : "No narration selected"}
          </p>
          <div className="audioCard">
            <div className="wave">▂▅▇▃▆▂▇▅▃▆▇▂▅▃▇▆▂▅</div>
            <span>{narration ? "Ready for timeline analysis" : "Waiting for audio"}</span>
          </div>
        </article>
      </section>

      <section className="pipeline">
        <div>
          <p className="eyebrow">AUTOMATIC PIPELINE</p>
          <h3>Images → narration sync → timeline → MP4</h3>
        </div>
        <div className="pipelineActions">
          <button className="primary" disabled={!ready || building || rendering} onClick={buildTimeline}>
            {building ? "Analyzing narration..." : timeline ? "Rebuild timeline" : ready ? "Build automatic timeline" : "Add images + narration"}
          </button>
          <button className="exportButton" disabled={!timeline || rendering || building} onClick={exportVideo}>
            {rendering ? "Rendering..." : "Export MP4"}
          </button>
        </div>
      </section>

      {(notice || error) && (
        <section className={error ? "message errorMessage" : "message"}>
          {error ?? notice}
        </section>
      )}

      {timeline && (
        <section className="timelinePanel">
          <div className="timelineHeader">
            <div>
              <p className="eyebrow">FIRST CUT</p>
              <h3>{timeline.clips.length} automatic clips</h3>
            </div>
            <div className="timelineMeta">
              <span>{timeline.width}×{timeline.height}</span>
              <span>{timeline.fps} fps</span>
              <span>{formatTime(timeline.duration)}</span>
            </div>
          </div>

          <div className="track">
            {timeline.clips.map((clip, index) => (
              <div
                className="clip"
                key={clip.id}
                style={{ flexGrow: Math.max(clip.duration, 0.1) }}
                title={fileName(clip.imagePath)}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{fileName(clip.imagePath)}</strong>
                <small>{clip.duration.toFixed(1)}s · slow zoom</small>
              </div>
            ))}
          </div>

          <p className="timelineHint">
            This first version distributes narration time evenly across the selected images. AI scene-to-script matching comes next.
          </p>
        </section>
      )}
    </main>
  );
}
