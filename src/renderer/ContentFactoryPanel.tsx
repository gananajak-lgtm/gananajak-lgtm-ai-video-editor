import { useState } from "react";
import type {
  ContentFormat,
  ContentLanguage,
  ContentProject
} from "../shared/content-factory";

type Props = {
  aiConfigured: boolean;
  project: ContentProject | null;
  onGenerated: (project: ContentProject) => void;
};

export default function ContentFactoryPanel({
  aiConfigured,
  project,
  onGenerated
}: Props) {
  const [topic, setTopic] = useState("");
  const [format, setFormat] = useState<ContentFormat>("short");
  const [language, setLanguage] = useState<ContentLanguage>("th");
  const [duration, setDuration] = useState(60);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderedPath, setRenderedPath] = useState<string | null>(null);

  const generate = async () => {
    if (!topic.trim() || !aiConfigured) return;

    setGenerating(true);
    setError(null);

    try {
      const result = await window.videoEditor.generateContentProject({
        topic: topic.trim(),
        format,
        language,
        targetDurationSeconds: Math.max(10, duration),
        tone: "cinematic documentary",
        audience: "general online video audience"
      });

      onGenerated(result);
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : String(generateError)
      );
    } finally {
      setGenerating(false);
    }
  };

  const generateAndRender = async () => {
    if (!project) return;
    setRendering(true);
    setRenderProgress(0);
    setRenderedPath(null);
    setError(null);
    const unsubscribe = window.videoEditor.onRenderProgress((progress) => {
      setRenderProgress(Math.max(0, Math.min(1, progress.progress)));
    });
    try {
      const outputPath = await window.videoEditor.chooseOutput();
      if (!outputPath) return;
      const result = await window.videoEditor.assembleAndRenderContent(project, outputPath);
      setRenderedPath(result.outputPath);
      setRenderProgress(1);
    } catch (renderError) {
      setError(renderError instanceof Error ? renderError.message : String(renderError));
    } finally {
      unsubscribe();
      setRendering(false);
    }
  };

  return (
    <section className="aiPanel">
      <div className="aiPanelHeader">
        <div>
          <p className="eyebrow">AI CONTENT FACTORY</p>
          <h3>Start with a topic, not a timeline</h3>
          <p className="muted">
            Generate a complete narration script plus production-ready scenes,
            image prompts, video prompts, timing, and sound-effect hints.
          </p>
        </div>
        <span className={aiConfigured ? "aiBadge readyBadge" : "aiBadge"}>
          {aiConfigured ? "Generator ready" : "API key required"}
        </span>
      </div>

      <div className="keyRow">
        <input
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          placeholder="Topic, e.g. Island of the Dolls"
        />
        <select
          value={format}
          onChange={(event) => setFormat(event.target.value as ContentFormat)}
        >
          <option value="short">Short</option>
          <option value="episode">Episode</option>
        </select>
        <select
          value={language}
          onChange={(event) => setLanguage(event.target.value as ContentLanguage)}
        >
          <option value="th">Thai</option>
          <option value="en">English</option>
        </select>
        <input
          type="number"
          min={10}
          max={7200}
          value={duration}
          onChange={(event) => setDuration(Number(event.target.value) || 60)}
          aria-label="Target duration in seconds"
        />
        <button
          className="primary"
          disabled={!aiConfigured || !topic.trim() || generating}
          onClick={generate}
        >
          {generating ? "Planning video..." : "Create script + scenes"}
        </button>
      </div>

      {error && <div className="message errorMessage">{error}</div>}

      {project && (
        <div className="transcriptPanel">
          <div className="timelineHeader">
            <div>
              <p className="eyebrow">CONTENT PROJECT</p>
              <h3>{project.title}</h3>
            </div>
            <div className="timelineMeta">
              <span>{project.scenes.length} scenes</span>
              <span>{project.brief.language}</span>
              <span>{project.brief.targetDurationSeconds}s target</span>
            </div>
          </div>

          <div className="keyRow">
            <button className="primary" onClick={generateAndRender} disabled={rendering}>
              {rendering ? `Rendering ${Math.round(renderProgress * 100)}%...` : "Generate & Render MP4"}
            </button>
            {rendering && <progress max={1} value={renderProgress} aria-label="Render progress" />}
            {renderedPath && <span className="muted">Video ready: {renderedPath}</span>}
          </div>

          <p className="muted">{project.script}</p>

          <div className="transcriptList">
            {project.scenes.map((scene) => (
              <div className="transcriptRow" key={scene.id}>
                <span>
                  Scene {String(scene.order).padStart(2, "0")} ·{" "}
                  {scene.estimatedDuration.toFixed(1)}s
                </span>
                <div>
                  <p>{scene.narration}</p>
                  <small>{scene.imagePrompt}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
