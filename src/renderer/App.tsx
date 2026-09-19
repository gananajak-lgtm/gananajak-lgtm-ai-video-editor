import { useEffect, useMemo, useState } from "react";
import type { AudioLayer, AiSettingsStatus, EditingBrainPlan, FullEpisodeTestReport, ProjectDocument, ProjectLoadResult, ProjectRelinkResult, RenderProgress, TimelinePlan, TranscriptResult, VisualBrainPlan } from "../shared/types";
import AudioLayersPanel from "./AudioLayersPanel";
import EditingBrainPanel from "./EditingBrainPanel";
import VisualBrainPanel from "./VisualBrainPanel";
import TimelineEditor from "./TimelineEditor";
import ProjectToolbar from "./ProjectToolbar";
import ExportSettingsPanel from "./ExportSettingsPanel";
import MediaRelinkPanel from "./MediaRelinkPanel";
import EpisodeReadinessPanel from "./EpisodeReadinessPanel";
import QuickPreviewPanel from "./QuickPreviewPanel";
import EpisodeQcPackPanel from "./EpisodeQcPackPanel";
import FullEpisodeTestPanel from "./FullEpisodeTestPanel";

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
  const [projectId, setProjectId] = useState(() => `project-${Date.now()}`);
  const [projectTitle, setProjectTitle] = useState("Untitled story");
  const [projectCreatedAt, setProjectCreatedAt] = useState(
    () => new Date().toISOString()
  );
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [autosaveState, setAutosaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [sessionReady, setSessionReady] = useState(false);
  const [missingMedia, setMissingMedia] = useState<string[]>([]);
  const [relinking, setRelinking] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [narration, setNarration] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TimelinePlan | null>(null);
  const [transcript, setTranscript] = useState<TranscriptResult | null>(null);
  const [editingPlan, setEditingPlan] = useState<EditingBrainPlan | null>(null);
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
  const [renderProgress, setRenderProgress] = useState<RenderProgress | null>(null);
  const [renderHistory, setRenderHistory] = useState<FullEpisodeTestReport[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applyLoadedProject = (loaded: ProjectLoadResult) => {
    const project = loaded.project;
    setProjectId(project.id);
    setProjectTitle(project.title);
    setProjectCreatedAt(project.createdAt);
    setProjectPath(loaded.filePath);
    setImages(project.images);
    setNarration(project.narration);
    setTranscript(project.transcript);
    setEditingPlan(project.editingPlan);
    setTimeline(
      project.timeline
        ? {
            ...project.timeline,
            quality: project.timeline.quality ?? "standard"
          }
        : null
    );
    setAudioLayers(project.audioLayers);
    setRenderHistory(project.renderHistory ?? []);
    setMissingMedia(loaded.missingMedia);

    if (loaded.missingMedia.length > 0) {
      setNotice(
        `Project restored with ${loaded.missingMedia.length} missing media file${loaded.missingMedia.length === 1 ? "" : "s"}. Replace those files before export.`
      );
    } else {
      setNotice(
        loaded.filePath
          ? "Project opened."
          : "Recovered the latest autosaved project."
      );
    }
    setError(null);
  };

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      window.videoEditor.getAiSettingsStatus(),
      window.videoEditor.loadAutosaveProject()
    ])
      .then(([status, autosave]) => {
        if (cancelled) return;
        setAiStatus(status);
        if (autosave) applyLoadedProject(autosave);
      })
      .catch((startupError) => {
        if (cancelled) return;
        setError(
          startupError instanceof Error
            ? startupError.message
            : String(startupError)
        );
      })
      .finally(() => {
        if (!cancelled) setSessionReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return window.videoEditor.onRenderProgress(setRenderProgress);
  }, []);

  const projectDocument = useMemo<ProjectDocument>(
    () => ({
      schemaVersion: 1,
      id: projectId,
      title: projectTitle.trim() || "Untitled story",
      createdAt: projectCreatedAt,
      updatedAt: new Date().toISOString(),
      images,
      narration,
      transcript,
      editingPlan,
      timeline,
      audioLayers,
      renderHistory
    }),
    [
      projectId,
      projectTitle,
      projectCreatedAt,
      images,
      narration,
      transcript,
      editingPlan,
      timeline,
      audioLayers,
      renderHistory
    ]
  );

  const hasProjectContent =
    images.length > 0 ||
    narration !== null ||
    transcript !== null ||
    timeline !== null ||
    audioLayers.length > 0;

  useEffect(() => {
    if (!sessionReady || !hasProjectContent) return;

    setAutosaveState("saving");
    const timer = window.setTimeout(() => {
      void window.videoEditor
        .autosaveProject(projectDocument)
        .then(() => setAutosaveState("saved"))
        .catch(() => setAutosaveState("error"));
    }, 800);

    return () => window.clearTimeout(timer);
  }, [sessionReady, hasProjectContent, projectDocument]);

  const openProjectFile = async () => {
    setError(null);

    try {
      const loaded = await window.videoEditor.openProject();
      if (loaded) {
        applyLoadedProject(loaded);
        setAutosaveState("saved");
      }
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : String(openError));
    }
  };

  const applyRelinkResult = (result: ProjectRelinkResult) => {
    const project = result.project;
    setImages(project.images);
    setNarration(project.narration);
    setTranscript(project.transcript);
    setEditingPlan(project.editingPlan);
    setTimeline(
      project.timeline
        ? {
            ...project.timeline,
            quality: project.timeline.quality ?? "standard"
          }
        : null
    );
    setAudioLayers(project.audioLayers);
    setRenderHistory(project.renderHistory ?? renderHistory);
    setMissingMedia(result.missingMedia);
    setNotice(
      result.relinked.length > 0
        ? `Relinked ${result.relinked.length} media file${result.relinked.length === 1 ? "" : "s"}. ${result.missingMedia.length} still missing.`
        : "No uniquely matching media files were found in that location."
    );
    setError(null);
  };

  const relinkFromFolder = async () => {
    if (!missingMedia.length) return;

    setRelinking(true);
    setError(null);
    try {
      const result = await window.videoEditor.relinkMissingMediaFromFolder(
        projectDocument,
        missingMedia
      );
      if (result) applyRelinkResult(result);
    } catch (relinkError) {
      setError(
        relinkError instanceof Error ? relinkError.message : String(relinkError)
      );
    } finally {
      setRelinking(false);
    }
  };

  const relinkSingle = async (missingPath: string) => {
    setRelinking(true);
    setError(null);
    try {
      const result = await window.videoEditor.relinkSingleMedia(
        projectDocument,
        missingPath
      );
      if (result) applyRelinkResult(result);
    } catch (relinkError) {
      setError(
        relinkError instanceof Error ? relinkError.message : String(relinkError)
      );
    } finally {
      setRelinking(false);
    }
  };

  const saveProjectFile = async () => {
    setError(null);

    try {
      const saved = await window.videoEditor.saveProject(
        projectDocument,
        projectPath
      );
      if (!saved) return;

      setProjectPath(saved.filePath);
      setAutosaveState("saved");
      setNotice(`Project saved: ${saved.filePath}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    }
  };

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
      setEditingPlan(null);
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
      setEditingPlan(null);
      setTimeline(null);
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
      const nextTimeline = await window.videoEditor.buildTimeline(
        images,
        narration,
        transcript
      );
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

  const applyVisualTimeline = (
    nextTimeline: TimelinePlan,
    visualPlan: VisualBrainPlan
  ) => {
    setTimeline(nextTimeline);
    setNotice(
      `Visual Brain created ${visualPlan.shots.length} planned shots from ${visualPlan.descriptors.length} analyzed images.`
    );
    setError(null);
  };

  const exportVideo = async () => {
    if (!timeline) return;

    const renderPlan = { ...timeline, audioLayers };
    const diagnostics = await window.videoEditor.analyzeRenderPlan(renderPlan);
    if (!diagnostics.ready) {
      const blocking = diagnostics.diagnostics
        .filter((item) => item.level === "error")
        .map((item) => item.message)
        .join(" ");
      setError(`Export blocked: ${blocking}`);
      setNotice(null);
      return;
    }

    const missing = await window.videoEditor.checkProjectMedia(projectDocument);
    setMissingMedia(missing);
    if (missing.length > 0) {
      setError(
        `Export blocked: ${missing.length} media file${missing.length === 1 ? "" : "s"} must be relinked first.`
      );
      setNotice(null);
      return;
    }

    const outputPath = await window.videoEditor.chooseOutput();
    if (!outputPath) return;

    setRendering(true);
    setRenderProgress({
      progress: 0,
      elapsed: 0,
      duration: timeline.duration
    });
    setError(null);
    setNotice("Rendering MP4 with FFmpeg...");

    try {
      const result = await window.videoEditor.renderTimeline(renderPlan, outputPath);
      if (result.testReport) {
        setRenderHistory((current) => [
          result.testReport as FullEpisodeTestReport,
          ...current.filter((item) => item.id !== result.testReport?.id)
        ].slice(0, 20));
      }
      setNotice(
        result.testReport
          ? `Export complete: ${result.outputPath} · Post-render test ${result.testReport.passed ? "passed" : "needs review"}.`
          : `Export complete: ${result.outputPath}`
      );
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
          Phase 1 · In-app playback foundation
        </div>
      </header>

      <ProjectToolbar
        title={projectTitle}
        projectPath={projectPath}
        autosaveState={autosaveState}
        onTitleChange={setProjectTitle}
        onOpen={openProjectFile}
        onSave={saveProjectFile}
      />

      <MediaRelinkPanel
        missingMedia={missingMedia}
        relinking={relinking}
        onRelinkFolder={relinkFromFolder}
        onRelinkSingle={relinkSingle}
      />

      <section className="hero">
        <div>
          <p className="kicker">Automatic story editing</p>
          <h2>Let the editor listen, see, plan shots, and place sound.</h2>
          <p className="lede">
            Long narration becomes a timestamped story map, grouped scenes, matched visuals, deliberate shot timing, and layered sound before the final cut is rendered.
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
        onPlanChange={setEditingPlan}
      />

      <VisualBrainPanel
        images={images}
        narration={narration}
        editingPlan={editingPlan}
        transcript={transcript}
        onTimelineReady={applyVisualTimeline}
      />

      <AudioLayersPanel layers={audioLayers} onChange={setAudioLayers} />

      <EpisodeReadinessPanel
        plan={timeline ? { ...timeline, audioLayers } : null}
      />

      <FullEpisodeTestPanel history={renderHistory} />

      {timeline && (
        <>
          <QuickPreviewPanel
            plan={{ ...timeline, audioLayers }}
            disabled={
              rendering ||
              building ||
              transcribing ||
              missingMedia.length > 0
            }
          />
          <EpisodeQcPackPanel
            plan={{ ...timeline, audioLayers }}
            disabled={
              rendering ||
              building ||
              transcribing ||
              missingMedia.length > 0
            }
          />
        </>
      )}

      <section className="pipeline">
        <div>
          <p className="eyebrow">EDITING PIPELINE</p>
          <h3>Story map → Visual Brain → timeline → multitrack MP4</h3>
        </div>
        <div className="pipelineActions">
          <button className="primary" disabled={!ready || building || rendering || transcribing} onClick={buildTimeline}>
            {building ? "Building timeline..." : timeline ? "Rebuild baseline timeline" : ready ? "Build baseline timeline" : "Add images + narration"}
          </button>
          <button className="exportButton" disabled={!timeline || rendering || building || transcribing || missingMedia.length > 0} onClick={exportVideo}>
            {rendering
              ? `Rendering ${Math.round((renderProgress?.progress ?? 0) * 100)}%...`
              : "Export MP4"}
          </button>
        </div>
      </section>

      {rendering && renderProgress && (
        <section className="renderProgressPanel">
          <div className="renderProgressHeader">
            <div>
              <p className="eyebrow">RENDERING</p>
              <strong>
                {Math.round(renderProgress.progress * 100)}% complete
              </strong>
            </div>
            <span>
              {formatTime(renderProgress.elapsed)} / {formatTime(renderProgress.duration)}
            </span>
          </div>
          <div className="renderProgressTrack">
            <div
              className="renderProgressFill"
              style={{
                width: `${Math.max(
                  1,
                  Math.min(100, renderProgress.progress * 100)
                )}%`
              }}
            />
          </div>
          <p>
            Long renders use a temporary FFmpeg filter script instead of placing
            the complete filter graph on the operating-system command line.
          </p>
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
              <span>{timeline.subtitles.length} subtitles</span>
              <span>{timeline.transitionDuration.toFixed(2)}s transition</span>
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
                <small>{clip.duration.toFixed(1)}s · {clip.motion}</small>
              </div>
            ))}
          </div>

          <p className="timelineHint">
            Visual Brain can now replace the fallback sequential edit with a timestamp-aligned shot plan. The baseline button remains available as a safe fallback.
          </p>

          <ExportSettingsPanel plan={timeline} onChange={setTimeline} />
          <TimelineEditor plan={timeline} onChange={setTimeline} />
        </section>
      )}
    </main>
  );
}
