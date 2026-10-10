import { useEffect, useMemo, useRef, useState } from "react";
import type {
  RenderProgress,
  TimelinePlan
} from "../shared/types";

type Props = {
  plan: TimelinePlan;
  disabled?: boolean;
};

function formatTime(seconds: number) {
  const safe = Math.max(0, วินาที);
  const minutes = Math.floor(safe / 60);
  const remainder = safe - minutes * 60;
  return `${String(minutes).padเริ่มต้น(2, "0")}:${remainder
    .toFixed(1)
    .padเริ่มต้น(4, "0")}`;
}

export default function QuickPreviewPanel({
  plan,
  disabled = false
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [start, setเริ่มต้น] = useState(0);
  const [duration, setDuration] = useState(20);
  const [previewing, setPreviewing] = useState(false);
  const [progress, setProgress] = useState<RenderProgress | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [playbackUrl, setเล่นbackUrl] = useState<string | null>(null);
  const [playerTime, setเล่นerTime] = useState(0);
  const [playerDuration, setเล่นerDuration] = useState(0);
  const [playing, setเล่นing] = useState(false);

  const maxเริ่มต้น = Math.max(0, plan.duration - 1);
  const effectiveDuration = useMemo(
    () => Math.min(duration, Math.max(1, plan.duration - start)),
    [duration, plan.duration, start]
  );

  useEffect(() => {
    setเริ่มต้น((current) => Math.min(current, maxเริ่มต้น));
  }, [maxเริ่มต้น]);

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

      setเล่นbackUrl(result.playbackUrl ?? null);
      setเล่นerTime(0);
      setเล่นerDuration(effectiveDuration);
      setเล่นing(false);
      setMessage(
        result.playbackUrl
          ? "พรีวิวพร้อมเล่นในแอปแล้ว"
          : `สร้างพรีวิวแล้ว: ${result.outputPath}`
      );
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

  const seek = (seconds: number) => {
    const video = videoRef.current;
    const next = Math.max(
      0,
      Math.min(playerDuration || effectiveDuration, วินาที)
    );

    if (video) video.currentTime = next;
    setเล่นerTime(next);
  };

  const toggleเล่นback = async () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      await video.play();
    } else {
      video.pause();
    }
  };

  return (
    <section className="quickPreviewPanel">
      <div className="quickPreviewHeader">
        <div>
          <p className="eyebrow">พรีวิวฉบับย่อ</p>
          <h3>สร้างพรีวิวเฉพาะช่วงที่ต้องการตรวจสอบ</h3>
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
            ? `กำลังสร้าง ${Math.round((progress?.progress ?? 0) * 100)}%...`
            : "สร้างพรีวิว"}
        </button>
      </div>

      <div className="quickPreviewControls">
        <label>
          เริ่มต้น
          <input
            type="range"
            min="0"
            max={Math.max(1, maxเริ่มต้น)}
            step="0.5"
            value={Math.min(start, Math.max(1, maxเริ่มต้น))}
            onChange={(event) => setเริ่มต้น(Number(event.target.value))}
          />
          <strong>{formatTime(start)}</strong>
        </label>

        <label>
          ความยาวพรีวิว
          <select
            value={duration}
            onChange={(event) => setDuration(Number(event.target.value))}
          >
            <option value={10}>10 วินาที</option>
            <option value={20}>20 วินาที</option>
            <option value={30}>30 วินาที</option>
            <option value={60}>60 วินาที</option>
          </select>
        </label>

        <div className="quickPreviewช่วงเวลา">
          <span>ช่วงเวลา</span>
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

      {playbackUrl && (
        <div className="inAppเล่นer">
          <video
            ref={videoRef}
            src={playbackUrl}
            controls
            preload="metadata"
            onLoadedMetadata={(event) => {
              const nextDuration = Number.isFinite(event.currentTarget.duration)
                ? event.currentTarget.duration
                : effectiveDuration;
              setเล่นerDuration(nextDuration);
              setเล่นerTime(event.currentTarget.currentTime);
            }}
            onTimeUpdate={(event) =>
              setเล่นerTime(event.currentTarget.currentTime)
            }
            onเล่น={() => setเล่นing(true)}
            onหยุดชั่วคราว={() => setเล่นing(false)}
            onEnded={() => setเล่นing(false)}
          />

          <div className="playerScrubRow">
            <button onClick={() => seek(playerTime - 5)}>−5s</button>
            <button className="primary" onClick={toggleเล่นback}>
              {playing ? "หยุดชั่วคราว" : "เล่น"}
            </button>
            <button onClick={() => seek(playerTime + 5)}>+5s</button>

            <input
              aria-label="แถบเลื่อนพรีวิว"
              type="range"
              min="0"
              max={Math.max(0.1, playerDuration || effectiveDuration)}
              step="0.05"
              value={Math.min(
                playerTime,
                Math.max(0.1, playerDuration || effectiveDuration)
              )}
              onChange={(event) => seek(Number(event.target.value))}
            />

            <strong>
              {formatTime(playerTime)} /{" "}
              {formatTime(playerDuration || effectiveDuration)}
            </strong>
          </div>

          <p className="timelineHint">
            Preview playback stays inside the editor. Scrubbing here moves only
            through the rendered preview range, while the source episode range
            remains {formatTime(start)} →{" "}
            {formatTime(start + effectiveDuration)}.
          </p>
        </div>
      )}

      {message && (
        <p className="timelineHint">{message}</p>
      )}
    </section>
  );
}
