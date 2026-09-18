import { useMemo, useState } from "react";

function fileName(filePath: string) {
  return filePath.split(/[\\/]/).pop() ?? filePath;
}

export default function App() {
  const [images, setImages] = useState<string[]>([]);
  const [narration, setNarration] = useState<string | null>(null);

  const ready = images.length > 0 && narration !== null;
  const summary = useMemo(() => {
    if (!images.length) return "No images selected";
    return images.length === 1 ? "1 image selected" : `${images.length} images selected`;
  }, [images]);

  const chooseImages = async () => {
    const picked = await window.videoEditor.selectImages();
    if (picked.length) setImages(picked);
  };

  const chooseNarration = async () => {
    const picked = await window.videoEditor.selectNarration();
    if (picked) setNarration(picked);
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
          Phase 1 · Project setup
        </div>
      </header>

      <section className="hero">
        <div>
          <p className="kicker">Automatic story editing</p>
          <h2>Turn narration and still images into a first-cut video.</h2>
          <p className="lede">
            Start with the ingredients. The editor will build the timeline and rendering pipeline in the next steps.
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
          <p className="eyebrow">NEXT PIPELINE</p>
          <h3>Images → narration sync → timeline → render</h3>
        </div>
        <button className="primary" disabled={!ready}>
          {ready ? "Build automatic timeline" : "Add images + narration"}
        </button>
      </section>
    </main>
  );
}
