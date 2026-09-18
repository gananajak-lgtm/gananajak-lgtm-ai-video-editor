import { useEffect, useMemo, useState } from "react";
import type { AudioLayer, AiSettingsStatus, TimelinePlan, TranscriptResult } from "../shared/types";
import AudioLayersPanel from "./AudioLayersPanel";
import EditingBrainPanel from "./EditingBrainPanel";

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
  const [transcript, setTranscript] = useState<TranscriptResult | null>(null);
  const [audioLayers, setAudioLayers] = useState<AudioLayer[]>([]);
  const [aiStatus, setAiStatus] = useState<AiSettingsStatus>({
    configured: false,
    persistedSecurely: false
  });
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [building, setBuilding] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void window.videoEditor.getAiSettingsStatus().then(setAiStatus);
  }, []);

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
      setTranscript(null);
      setTimeline(null);
      setNotice(null);
      setError(null);
    }
  };

  const saveApiKey = async () => {
    if (!apiKeyDraft.trim()) return;

    setSavingKey(true);
    setError(null);

    try {
      const status = await window.videoEditor.saveOpenAiApiKey(apiKeyDraft);
      setAiStatus(status);
      setApiKeyDraft("");
      setNotice(
        status.persistedSecurely
          ? "AI key saved securely on this computer."
          : "AI key is active for this session."
      );
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setSavingKey(false);
    }
  };

  const transcribeNarration = async () => {
    if (!narration) return;

    setTranscribing(true);
    setError(null);
    setNotice("Listening to the full narration and creating timestamped speech segments...");

    try {
      const result = await window.videoEditor.transcribeNarration(narration);
      setTranscript(result);
      setNotice(
        `Narration analyzed: ${result.segments.length} timestamped speech segments across ${formatTime(result.duration)}.`
      );
    } catch (transcribeError) {
      setError(
        transcribeError instanceof Error
          ? transcribeError.message
          : String(transcribeError)
      );
      setNotice(null);
    } finally {
      setTranscribing(false);
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

  const applyAutomaticSfx = (layers: AudioLayer[]) => {
    setAudioLayers((current) => [
      ...current.filter((layer) => layer.origin !== "auto-sfx"),
      ...layers
    ]);
    setNotice(
      layers.length > 0
        ? `Editing Brain placed ${layers.length} automatic SFX layer${layers.length === 1 ? "" : "s"}.`
        : "Editing Brain found scene cues, but no imported SFX files matched them yet."
    );
  };

  const exportVideo = async () => {
    if (!timeline) return;

    const outputPath = await window.videoEditor.chooseOutput();
    if (!outputPath) return;

    setRendering(true);
    setError(null);
    setNotice("Rendering MP4 with FFmpeg...");

    try {
      const renderPlan = { ...timeline, audioLayers };
      const result = await window.videoEditor.renderTimeline(renderPlan, outputPath);
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
          Phase 1 · Editing Brain foundation
        </div>
      </header>

      <section className="hero">
        <div>
          <p className="kicker">Automatic story editing</p>
          <h2>Let the editor listen, group scenes, and place sound.</h2>
          <p className="lede">
            Long narration becomes a timestamped story map, grouped scenes, and an automatic sound-effects plan before the final cut is rendered.
          </p>
        </div>
        <div className="heroBadge">🎧</div>
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
            <span>
              {transcript
                ? `${transcript.segments.length} timestamped segments ready`
                : narration
                  ? "Ready for AI listening"
                  : "Waiting for audio"}
            </span>
          </div>
        </article>
      </section>

      <section className="aiPanel">
        <div className="aiPanelHeader">
          <div>
            <p className="eyebrow">AI AUDIO BRAIN</p>
            <h3>Listen to a full episode and keep exact timing</h3>
            <p className="muted">
              The audio is processed in 10-minute chunks, then every speech segment is restored to its original episode timestamp.
            </p>
          </div>
          <span className={aiStatus.configured ? "aiBadge readyBadge" : "aiBadge"}>
            {aiStatus.configured ? "AI connected" : "API key required"}
          </span>
        </div>

        {!aiStatus.configured && (
          <div className="keyRow">
            <input
              type="password"
              value={apiKeyDraft}
              onChange={(event) => setApiKeyDraft(event.target.value)}
              placeholder="OpenAI API key"
              autoComplete="off"
            />
            <button disabled={!apiKeyDraft.trim() || savingKey} onClick={saveApiKey}>
              {savingKey ? "Saving..." : "Save key"}
            </button>
          </div>
        )}

        {aiStatus.configured && (
          <div className="aiControls">
            <div>
              <strong>Timestamp transcription</strong>
              <small>
                {aiStatus.persistedSecurely
                  ? "Key is stored using operating-system encryption."
                  : "Key is available for this session or environment."}
              </small>
            </div>
            <button
              className="primary"
              disabled={!narration || transcribing || rendering || building}
              onClick={transcribeNarration}
            >
              {transcribing ? "Listening to narration..." : transcript ? "Analyze again" : "Analyze long narration"}
            </button>
          </div>
        )}
      </section>

      {(notice || error) && (
        <section className={error ? "message errorMessage" : "message"}>
          {error ?? notice}
        </section>
      )}

      {transcript && (
        <section className="transcriptPanel">
          <div className="timelineHeader">
            <div>
              <p className="eyebrow">STORY MAP</p>
              <h3>Timestamped narration</h3>
            </div>
            <div className="timelineMeta">
              <span>{transcript.language ?? "auto language"}</span>
              <span>{transcript.segments.length} segments</span>
              <span>{formatTime(transcript.duration)}</span>
            </div>
          </div>

          <div className="transcriptList">
            {transcript.segments.slice(0, 24).map((segment) => (
              <div className="transcriptRow" key={segment.id}>
                <span>
                  {formatTime(segment.start)} → {formatTime(segment.end)}
                </span>
                <p>{segment.text}</p>
              </div>
            ))}
          </div>

          {transcript.segments.length > 24 && (
            <p className="timelineHint">
              Showing the first 24 segments. The complete transcript remains available to the editing engine.
            </p>
          )}
        </section>
      )}

      <EditingBrainPanel
        transcript={transcript}
        onApplyAutoLayers={applyAutomaticSfx}
      />

      <AudioLayersPanel layers={audioLayers} onChange={setAudioLayers} />

      <section className="pipeline">
        <div>
          <p className="eyebrow">EDITING PIPELINE</p>
          <h3>Story map → image matching → timeline → MP4</h3>
        </div>
        <div className="pipelineActions">
          <button className="primary" disabled={!ready || building || rendering || transcribing} onClick={buildTimeline}>
            {building ? "Building timeline..." : timeline ? "Rebuild baseline timeline" : ready ? "Build baseline timeline" : "Add images + narration"}
          </button>
          <button className="exportButton" disabled={!timeline || rendering || building || transcribing} onClick={exportVideo}>
            {rendering ? "Rendering..." : "Export MP4"}
          </button>
        </div>
      </section>

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
            The current baseline still places images sequentially. The new timestamped story map is the foundation for the next Visual Brain step that will choose images by scene meaning.
          </p>
        </section>
      )}
    </main>
  );
}
