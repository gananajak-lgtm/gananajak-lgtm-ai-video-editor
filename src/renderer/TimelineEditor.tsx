import { useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import type {
  AudioLayer,
  ShotMotion,
  SubtitleCue,
  TimelineClip,
  TimelinePlan
} from "../shared/types";

type Props = {
  plan: TimelinePlan;
  onChange: (plan: TimelinePlan) => void;
  seekRequest?: { id: number; seconds: number } | null;
  audioLayers?: AudioLayer[];
  onAudioLayersChange?: (layers: AudioLayer[]) => void;
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

export default function TimelineEditor({ plan, onChange, seekRequest, audioLayers = [], onAudioLayersChange }: Props) {
  const [selectedClipIndex, setSelectedClipIndex] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [shotPage, setShotPage] = useState(0);
  const trackViewportRef = useRef<HTMLDivElement | null>(null);
  const [trackViewport, setTrackViewport] = useState({ left: 0, width: 900 });
  const [draggedAudioId, setDraggedAudioId] = useState<string | null>(null);
  const audioDragOffsetRef = useRef(0);
  const draggedAudioIdRef = useRef<string | null>(null);
  const [audioDragError, setAudioDragError] = useState<string | null>(null);
  const [selectedAudioId, setSelectedAudioId] = useState<string | null>(null);
  const studioAudio = audioLayers.filter(layer => layer.origin === "studio-dialogue");
  const selectedAudio = studioAudio.find(layer => layer.id === selectedAudioId);
  const orderedStudioAudio = [...studioAudio].sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
  const selectedAudioIndex = orderedStudioAudio.findIndex(layer => layer.id === selectedAudioId);
  const focusSelectedAudio = () => {
    if (!selectedAudio) return;
    seekTo(selectedAudio.start);
    const viewport = trackViewportRef.current;
    if (viewport) scrollTimelineTo(Math.max(0, selectedAudio.start * pixelsPerSecond - viewport.clientWidth / 3));
  };
  const selectAdjacentAudio = (offset: number) => {
    const index = selectedAudioIndex < 0 ? 0 : selectedAudioIndex + offset;
    const layer = orderedStudioAudio[index];
    if (!layer) return;
    setSelectedAudioId(layer.id);
    seekTo(layer.start);
  };
  const moveSelectedAudio = (delta: number) => {
    if (!selectedAudio || !onAudioLayersChange) return;
    const start = Math.round(Math.max(0, Math.min(Math.max(0, plan.duration - selectedAudio.duration), selectedAudio.start + delta)) * 100) / 100;
    if (studioAudio.some(other => other.id !== selectedAudio.id && start < other.start + other.duration - 0.001 && start + selectedAudio.duration > other.start + 0.001)) {
      setAudioDragError("ไม่สามารถเลื่อนเสียงทับบรรทัดอื่นได้");
      return;
    }
    setAudioDragError(null);
    onAudioLayersChange(audioLayers.map(layer => layer.id === selectedAudio.id ? { ...layer, start } : layer));
  };
  const dropStudioAudio = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const id = draggedAudioIdRef.current;
    draggedAudioIdRef.current = null;
    setDraggedAudioId(null);
    if (!id || !onAudioLayersChange) return;
    const target = studioAudio.find(layer => layer.id === id);
    if (!target) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const rawStart = (event.clientX - bounds.left) / pixelsPerSecond - audioDragOffsetRef.current;
    const start = Math.round(Math.max(0, Math.min(Math.max(0, plan.duration - target.duration), rawStart)) * 10) / 10;
    const collision = studioAudio.some(other => other.id !== id && start < other.start + other.duration - 0.001 && start + target.duration > other.start + 0.001);
    if (collision) {
      setAudioDragError("ไม่สามารถวางเสียงทับบรรทัดอื่นได้ กรุณาเลือกตำแหน่งว่าง");
      return;
    }
    setAudioDragError(null);
    setSelectedAudioId(id);
    onAudioLayersChange(audioLayers.map(layer => layer.id === id ? { ...layer, start } : layer));
  };
  const pixelsPerSecond = 24 * timelineZoom;
  const trackWidth = Math.max(900, plan.duration * pixelsPerSecond);
  const trackVisibleStart = Math.max(0, trackViewport.left / pixelsPerSecond - 6);
  const trackVisibleEnd = (trackViewport.left + trackViewport.width) / pixelsPerSecond + 6;
  const trackClips = plan.clips.map((clip, index) => ({ clip, index })).filter(({ clip }) =>
    clip.start + clip.duration >= trackVisibleStart && clip.start <= trackVisibleEnd
  );
  const scrollTimelineTo = (left: number) => {
    const viewport = trackViewportRef.current;
    if (!viewport) return;
    viewport.scrollLeft = Math.max(0, left);
    setTrackViewport({ left: viewport.scrollLeft, width: viewport.clientWidth });
  };
  const goToSelectedClip = () => {
    const clip = plan.clips[selectedClipIndex];
    if (clip) scrollTimelineTo(clip.start * pixelsPerSecond);
  };
  const changeTimelineZoom = (zoom: number) => {
    const viewport = trackViewportRef.current;
    const centerSeconds = viewport
      ? (viewport.scrollLeft + viewport.clientWidth / 2) / pixelsPerSecond
      : playheadSeconds;
    setTimelineZoom(zoom);
    if (viewport) {
      const left = Math.max(0, centerSeconds * 24 * zoom - viewport.clientWidth / 2);
      viewport.scrollLeft = left;
      setTrackViewport({ left: viewport.scrollLeft, width: viewport.clientWidth });
    }
  };
  const SHOT_PAGE_SIZE = 25;
  const shotPages = Math.max(1, Math.ceil(plan.clips.length / SHOT_PAGE_SIZE));
  const currentShotPage = Math.min(shotPage, shotPages - 1);
  const [draggedClipIndex, setDraggedClipIndex] = useState<number | null>(null);
  const [playheadSeconds, setPlayheadSeconds] = useState(0);

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

  useEffect(() => {
    setPlayheadSeconds((current) => Math.min(current, plan.duration));
  }, [plan.duration]);

  const seekTo = (seconds: number) => {
    const target = Math.max(0, Math.min(plan.duration, seconds));
    setPlayheadSeconds(target);
    const index = plan.clips.findIndex((clip) => target >= clip.start && target < clip.start + clip.duration);
    const nextIndex = index >= 0 ? index : plan.clips.length - 1;
    if (nextIndex >= 0) {
      setSelectedClipIndex(nextIndex);
      const clip = plan.clips[nextIndex];
      const viewport = trackViewportRef.current;
      if (clip && viewport) {
        const clipLeft = clip.start * pixelsPerSecond;
        const clipRight = (clip.start + clip.duration) * pixelsPerSecond;
        if (clipLeft < viewport.scrollLeft || clipLeft > viewport.scrollLeft + viewport.clientWidth || clipRight < viewport.scrollLeft) {
          scrollTimelineTo(Math.max(0, clipLeft - viewport.clientWidth / 3));
        }
      }
    }
  };

  useEffect(() => {
    if (seekRequest) seekTo(seekRequest.seconds);
    // Each request has a unique id; ordinary timeline edits must not repeat seeks.
  }, [seekRequest?.id]);

  const totalClipDuration = useMemo(
    () => plan.clips.reduce((sum, clip) => sum + clip.duration, 0),
    [plan.clips]
  );

  const patchClip = (index: number, patch: Partial<TimelineClip>) => {
    const clips = plan.clips.map((clip, clipIndex) =>
      clipIndex === index ? { ...clip, ...patch } : clip
    );
    // Keep clip start timestamps contiguous after duration edits.
    onChange({ ...plan, clips: rebuildStarts(clips) });
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

  const moveClip = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= plan.clips.length || to >= plan.clips.length) return;
    const clips = plan.clips.map(clip => ({ ...clip }));
    const [moved] = clips.splice(from, 1);
    clips.splice(to, 0, moved);
    onChange({ ...plan, clips: rebuildStarts(clips) });
    setSelectedClipIndex(to);
  };

  const removeSelectedClip = () => {
    const clip = plan.clips[selectedClipIndex];
    if (!clip) return;
    if (!window.confirm(`ลบช็อต “${fileName(clip.imagePath)}” ออกจากไทม์ไลน์?\\nความยาวภาพจะสั้นลง แต่ไฟล์ต้นฉบับจะไม่ถูกลบ`)) return;
    const clips = rebuildStarts(plan.clips.filter((_, index) => index !== selectedClipIndex));
    onChange({ ...plan, clips });
    setSelectedClipIndex(Math.max(0, Math.min(selectedClipIndex, clips.length - 1)));
  };

  const splitAtPlayhead = () => {
    const index = plan.clips.findIndex((clip) =>
      playheadSeconds > clip.start + MIN_CLIP_SECONDS &&
      playheadSeconds < clip.start + clip.duration - MIN_CLIP_SECONDS
    );
    if (index < 0) return;
    const original = plan.clips[index];
    const leftDuration = playheadSeconds - original.start;
    const rightDuration = original.duration - leftDuration;
    const right: TimelineClip = {
      ...original,
      id: `${original.id}-split-${Date.now()}`,
      start: playheadSeconds,
      duration: rightDuration
    };
    const clips = [
      ...plan.clips.slice(0, index),
      { ...original, duration: leftDuration },
      right,
      ...plan.clips.slice(index + 1)
    ];
    onChange({ ...plan, clips: rebuildStarts(clips) });
    setSelectedClipIndex(index + 1);
  };

  const canSplitAtPlayhead = plan.clips.some((clip) =>
    playheadSeconds > clip.start + MIN_CLIP_SECONDS &&
    playheadSeconds < clip.start + clip.duration - MIN_CLIP_SECONDS
  );

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

      <div className="editorTrackSurface">
        <div className="editorTrackToolbar">
          <strong>🎬 Timeline · ภาพ {plan.clips.length} · เสียง {studioAudio.length}</strong>
          <label>ซูม <input type="range" min="0.5" max="3" step="0.25" value={timelineZoom} onChange={(event) => changeTimelineZoom(Number(event.target.value))} /></label>
          <span>{timelineZoom.toFixed(2)}×</span>
          <button type="button" onClick={() => changeTimelineZoom(0.5)} aria-label="ซูมออกเพื่อดูภาพรวม">ภาพรวม 0.5×</button>
          <button type="button" onClick={() => changeTimelineZoom(1)} aria-label="ซูมระดับปกติ">ปกติ 1×</button>
          <button type="button" onClick={() => changeTimelineZoom(2)} aria-label="ซูมเข้าเพื่อปรับเสียง">ละเอียด 2×</button>
        </div>
        <div className="editorPlayheadControl">
          <label htmlFor="timeline-playhead">หัวอ่านเวลา</label>
          <input id="timeline-playhead" type="range" min="0" max={Math.max(plan.duration, 0.01)} step="0.1" value={Math.min(playheadSeconds, plan.duration)} onChange={(event) => seekTo(Number(event.target.value))} />
          <output htmlFor="timeline-playhead">{formatTime(playheadSeconds)} / {formatTime(plan.duration)}</output>
          <button type="button" disabled={!canSplitAtPlayhead} onClick={splitAtPlayhead} title="แบ่งช็อตที่ตำแหน่งหัวอ่านเวลาโดยรักษาระยะเวลารวม">✂ แยกช็อต</button>
        </div>
        <div className="editorMediaPager" aria-label="เลื่อนไทม์ไลน์">
          <span>🎞 ภาพ {trackClips.length}/{plan.clips.length} · 🎙 เสียง {studioAudio.filter(layer => layer.start + layer.duration >= trackVisibleStart && layer.start <= trackVisibleEnd).length}/{studioAudio.length} · เลื่อนแนวนอนได้</span>
          <button type="button" onClick={goToSelectedClip}>ไปช็อตที่เลือก</button>
        </div>
        <div className="editorTrackScroller" ref={trackViewportRef} onScroll={event => setTrackViewport({ left: event.currentTarget.scrollLeft, width: event.currentTarget.clientWidth })}>
          <div className="editorTrackClips" aria-label="แทร็กภาพ" style={{ position: "relative", width: trackWidth + "px", minWidth: trackWidth + "px" }}>
            {trackClips.map(({ clip, index }) => (
              <button
                type="button"
                key={clip.id}
                draggable
                onDragStart={event => { setDraggedClipIndex(index); event.dataTransfer.effectAllowed = "move"; }}
                onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }}
                onDrop={event => { event.preventDefault(); if (draggedClipIndex !== null) moveClip(draggedClipIndex, index); setDraggedClipIndex(null); }}
                onDragEnd={() => setDraggedClipIndex(null)}
                onClick={() => { setSelectedClipIndex(index); setPlayheadSeconds(clip.start); }}
                aria-pressed={selectedClipIndex === index}
                className={selectedClipIndex === index ? "editorTrackClip editorTrackClipSelected" : "editorTrackClip"}
                style={{ position: "absolute", left: clip.start * pixelsPerSecond, width: Math.max(1, clip.duration * pixelsPerSecond - 3), height: "100%" }}
                title={`${fileName(clip.imagePath)} · ${formatTime(clip.start)} · ${clip.duration.toFixed(1)}s`}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{fileName(clip.imagePath)}</strong>
                <small>{clip.duration.toFixed(1)}s</small>
              </button>
            ))}
          </div>
          {studioAudio.length > 0 && <div className="editorTrackClips" aria-label="แทร็กเสียงตัวละคร · ลากคลิปเพื่อปรับเวลา" onDragOver={event => { if (draggedAudioIdRef.current) event.preventDefault(); }} onDrop={dropStudioAudio} style={{ position: "relative", width: trackWidth + "px", height: 54, borderTop: "1px solid #777" }}>
            {studioAudio.filter(layer => layer.start + layer.duration >= trackVisibleStart && layer.start <= trackVisibleEnd).map(layer => <button type="button" draggable key={layer.id} className={selectedAudioId === layer.id ? "editorTrackClip editorTrackClipSelected" : "editorTrackClip"} aria-pressed={selectedAudioId === layer.id} onDragStart={event => { audioDragOffsetRef.current = (event.clientX - event.currentTarget.getBoundingClientRect().left) / pixelsPerSecond; draggedAudioIdRef.current = layer.id; setDraggedAudioId(layer.id); event.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => { draggedAudioIdRef.current = null; setDraggedAudioId(null); }} onClick={() => { setSelectedAudioId(layer.id); seekTo(layer.start); }} style={{ position: "absolute", left: layer.start * pixelsPerSecond, width: Math.max(12, layer.duration * pixelsPerSecond - 2), height: 48, overflow: "hidden" }} title={(layer.voiceLineId ?? layer.label ?? "เสียงตัวละคร") + " · " + formatTime(layer.start)}>
              <span>🎙 {layer.voiceLineId ?? layer.label ?? "เสียง"}</span>
            </button>)}
          </div>}
        </div>
        {selectedAudio && <div className="editorMediaPager" aria-label="แก้เสียงตัวละครที่เลือก">
          <button type="button" disabled={selectedAudioIndex <= 0} onClick={() => selectAdjacentAudio(-1)} title="เลือกเสียงก่อนหน้า">◀ เสียงก่อน</button>
          <strong>🎙 {selectedAudio.voiceLineId ?? selectedAudio.label ?? "เสียงตัวละคร"}</strong>
          <button type="button" disabled={selectedAudioIndex < 0 || selectedAudioIndex >= orderedStudioAudio.length - 1} onClick={() => selectAdjacentAudio(1)} title="เลือกเสียงถัดไป">เสียงถัดไป ▶</button>
          <button type="button" onClick={() => moveSelectedAudio(-0.1)} disabled={!onAudioLayersChange}>◀ 0.1 วิ</button>
          <span>บรรทัด {selectedAudioIndex + 1}/{studioAudio.length} · เริ่ม {formatTime(selectedAudio.start)} · สิ้นสุด {formatTime(selectedAudio.start + selectedAudio.duration)} · ยาว {selectedAudio.duration.toFixed(1)} วิ</span>
          <button type="button" onClick={() => moveSelectedAudio(0.1)} disabled={!onAudioLayersChange}>0.1 วิ ▶</button>
          <button type="button" onClick={focusSelectedAudio}>◎ แสดงคลิปในจอ</button>
        </div>}
        {audioDragError && <p role="alert">{audioDragError}</p>}
        <p className="muted">แทร็กบน: ภาพ (ลากเพื่อจัดลำดับ) · แทร็กล่าง: เสียงตัวละคร (ลากเพื่อปรับเวลา) · คลิกเสียงเพื่อปรับละเอียด ±0.1 วินาที</p>
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
              <button type="button" className="removeButton" onClick={removeSelectedClip}>
                🗑️ ลบช็อตที่เลือก
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
          <div className="editorMediaPager"><button type="button" disabled={currentShotPage === 0} onClick={() => setShotPage(currentShotPage - 1)}>ก่อนหน้า</button><span>ช็อต {currentShotPage * SHOT_PAGE_SIZE + 1}–{Math.min((currentShotPage + 1) * SHOT_PAGE_SIZE, plan.clips.length)} / {plan.clips.length}</span><button type="button" disabled={currentShotPage >= shotPages - 1} onClick={() => setShotPage(currentShotPage + 1)}>ถัดไป</button><button type="button" onClick={() => setShotPage(Math.floor(selectedClipIndex / SHOT_PAGE_SIZE))}>ไปช็อตที่เลือก</button></div>
          <div className="manualSectionTitle">
            <strong>Shots</strong>
            <small>Cut nudges preserve total runtime</small>
          </div>

          {plan.clips.slice(currentShotPage * SHOT_PAGE_SIZE, (currentShotPage + 1) * SHOT_PAGE_SIZE).map((clip, pageIndex) => { const index = currentShotPage * SHOT_PAGE_SIZE + pageIndex; return (
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
          ); })}
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
