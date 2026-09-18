import { useEffect, useMemo, useState } from "react";
import type {
  ShotMotion,
  SubtitleCue,
  TimelineClip,
  TimelinePlan
} from "../shared/types";

type Props = {
  plan: TimelinePlan;
  onChange: (plan: TimelinePlan) => void;
};

const MIN_CLIP_SECONDS = 0.6;

function fileName(filePath: string) {
  return filePath.split(/[\\/]/).pop() ?? filePath;
}

function formatTime(seconds: number) {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const remainder = safe - minutes * 60;
  return `${String(minutes).padStart(2, "0")}:${remainder
    .toFixed(1)
    .padStart(4, "0")}`;
}

function rebuildStarts(clips: TimelineClip[]) {
  let cursor = 0;

  return clips.map((clip) => {
    const next = {
      ...clip,
      start: cursor,
      duration: Math.max(MIN_CLIP_SECONDS, clip.duration)
    };
    cursor += next.duration;
    return next;
  });
}

function motionLabel(motion: ShotMotion) {
  switch (motion) {
    case "hold":
      return "Hold";
    case "slow-zoom-out":
      return "Slow zoom out";
    case "pan-left":
      return "Pan left";
    case "pan-right":
      return "Pan right";
    case "slow-zoom-in":
    default:
      return "Slow zoom in";
  }
}

export default function TimelineEditor({ plan, onChange }: Props) {
  const [selectedClipIndex, setSelectedClipIndex] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const selectedClip =
    plan.clips[Math.min(selectedClipIndex, Math.max(0, plan.clips.length - 1))];

  useEffect(() => {
    if (selectedClipIndex >= plan.clips.length) {
      setSelectedClipIndex(Math.max(0, plan.clips.length - 1));
    }
  }, [plan.clips.length, selectedClipIndex]);

  useEffect(() => {
    let cancelled = false;

    if (!selectedClip) {
      setPreview(null);
      return;
    }

    setPreviewLoading(true);
    setPreview(null);

    void window.videoEditor
      .readImagePreview(selectedClip.imagePath)
      .then((dataUrl) => {
        if (!cancelled) setPreview(dataUrl);
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedClip?.imagePath]);

  const totalClipDuration = useMemo(
    () => plan.clips.reduce((sum, clip) => sum + clip.duration, 0),
    [plan.clips]
  );

  const patchClip = (index: number, patch: Partial<TimelineClip>) => {
    const clips = plan.clips.map((clip, clipIndex) =>
      clipIndex === index ? { ...clip, ...patch } : clip
    );
    onChange({ ...plan, clips });
  };

  const shiftBoundary = (index: number, requestedDelta: number) => {
    if (index < 0 || index >= plan.clips.length - 1) return;

    const clips = plan.clips.map((clip) => ({ ...clip }));
    const current = clips[index];
    const next = clips[index + 1];

    const maxEarlier = Math.max(0, current.duration - MIN_CLIP_SECONDS);
    const maxLater = Math.max(0, next.duration - MIN_CLIP_SECONDS);
    const delta = Math.max(
      -maxEarlier,
      Math.min(maxLater, requestedDelta)
    );

    if (Math.abs(delta) < 0.001) return;

    current.duration += delta;
    next.duration -= delta;

    onChange({
      ...plan,
      clips: rebuildStarts(clips)
    });
  };

  const replaceImage = async (index: number) => {
    const picked = await window.videoEditor.selectImages();
    const replacement = picked[0];
    if (!replacement) return;

    patchClip(index, { imagePath: replacement });
  };

  const patchSubtitle = (id: string, patch: Partial<SubtitleCue>) => {
    onChange({
      ...plan,
      subtitles: plan.subtitles.map((cue) =>
        cue.id === id ? { ...cue, ...patch } : cue
      )
    });
  };

  const removeSubtitle = (id: string) => {
    onChange({
      ...plan,
      subtitles: plan.subtitles.filter((cue) => cue.id !== id)
    });
  };

  const setTransition = (value: number) => {
    onChange({
      ...plan,
      transitionDuration: Math.max(0, Math.min(1.25, value))
    });
  };

  return (
    <section className="manualEditor">
      <div className="manualEditorHeader">
        <div>
          <p className="eyebrow">MANUAL FINISHING</p>
          <h3>Fix only the shots AI did not get right</h3>
          <p className="muted">
            Replace a still, change camera motion, shift a cut by half a second,
            edit subtitle text, or remove a subtitle without breaking narration
            length.
          </p>
        </div>

        <label className="transitionControl">
          Crossfade
          <div>
            <input
              type="range"
              min="0"
              max="1.25"
              step="0.05"
              value={plan.transitionDuration}
              onChange={(event) =>
                setTransition(Number(event.target.value))
              }
            />
            <strong>{plan.transitionDuration.toFixed(2)}s</strong>
          </div>
        </label>
      </div>

      <div className="manualEditorMeta">
        <span>{plan.clips.length} shots</span>
        <span>{plan.subtitles.length} subtitle cues</span>
        <span>{formatTime(totalClipDuration)} visual runtime</span>
        <span>{formatTime(plan.duration)} narration runtime</span>
      </div>

      <div className="manualEditorGrid">
        <div className="shotInspector">
          <div className="previewFrame">
            {preview ? (
              <img src={preview} alt="Selected shot preview" />
            ) : (
              <div className="previewPlaceholder">
                {previewLoading ? "Loading preview..." : "Preview unavailable"}
              </div>
            )}
            {selectedClip && (
              <div className="previewOverlay">
                <strong>{fileName(selectedClip.imagePath)}</strong>
                <span>
                  {formatTime(selectedClip.start)} ·{" "}
                  {selectedClip.duration.toFixed(1)}s ·{" "}
                  {motionLabel(selectedClip.motion)}
                </span>
              </div>
            )}
          </div>

          {selectedClip && (
            <div className="inspectorControls">
              <button onClick={() => replaceImage(selectedClipIndex)}>
                Replace image
              </button>

              <label>
                Motion
                <select
                  value={selectedClip.motion}
                  onChange={(event) =>
                    patchClip(selectedClipIndex, {
                      motion: event.target.value as ShotMotion
                    })
                  }
                >
                  <option value="hold">Hold</option>
                  <option value="slow-zoom-in">Slow zoom in</option>
                  <option value="slow-zoom-out">Slow zoom out</option>
                  <option value="pan-left">Pan left</option>
                  <option value="pan-right">Pan right</option>
                </select>
              </label>

              {selectedClipIndex < plan.clips.length - 1 && (
                <div className="boundaryControls">
                  <span>Move next cut</span>
                  <div>
                    <button
                      onClick={() =>
                        shiftBoundary(selectedClipIndex, -0.5)
                      }
                    >
                      Earlier 0.5s
                    </button>
                    <button
                      onClick={() =>
                        shiftBoundary(selectedClipIndex, 0.5)
                      }
                    >
                      Later 0.5s
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="shotList">
          <div className="manualSectionTitle">
            <strong>Shots</strong>
            <small>Cut nudges preserve total runtime</small>
          </div>

          {plan.clips.map((clip, index) => (
            <button
              className={
                index === selectedClipIndex
                  ? "shotEditRow selectedShotEditRow"
                  : "shotEditRow"
              }
              key={clip.id}
              onClick={() => setSelectedClipIndex(index)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <strong>{fileName(clip.imagePath)}</strong>
                <small>
                  {formatTime(clip.start)} · {clip.duration.toFixed(1)}s ·{" "}
                  {motionLabel(clip.motion)}
                </small>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="subtitleEditor">
        <div className="manualSectionTitle">
          <strong>Subtitle corrections</strong>
          <small>Edit or hide individual transcript lines</small>
        </div>

        {plan.subtitles.length === 0 ? (
          <div className="emptyBrainResult">No subtitles on this timeline.</div>
        ) : (
          <div className="subtitleEditList">
            {plan.subtitles.map((cue) => (
              <div className="subtitleEditRow" key={cue.id}>
                <span>
                  {formatTime(cue.start)} → {formatTime(cue.end)}
                </span>
                <textarea
                  rows={2}
                  value={cue.text}
                  onChange={(event) =>
                    patchSubtitle(cue.id, { text: event.target.value })
                  }
                />
                <button
                  className="removeButton"
                  onClick={() => removeSubtitle(cue.id)}
                >
                  Hide line
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
