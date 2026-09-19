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
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const remainder = safe - minutes * 60;
  return `${String(minutes).padStart(2, "0")}:${remainder
    .toFixed(1)
    .padStart(4, "0")}`;
}

export default function QuickPreviewPanel({
  plan,
  disabled = false
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [start, setStart] = useState(0);
  const [duration, setDuration] = useState(20);
  const [previewing, setPreviewing] = useState(false);
  const [progress, setProgress] = useState<RenderProgress | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [playerTime, setPlayerTime] = useState(0);
  const [playerDuration, setPlayerDuration] = useState(0);
  const [playing, setPlaying] = useState(false);

  const maxStart = Math.max(0, plan.duration - 1);
  const effectiveDuration = useMemo(
    () => Math.min(duration, Math.max(1, plan.duration - start)),
    [duration, plan.duration, start]
  );

  useEffect(() => {
    setStart((current) => Math.min(current, maxStart));
  }, [maxStart]);

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

      setPlaybackUrl(result.playbackUrl ?? null);
      setPlayerTime(0);
      setPlayerDuration(effectiveDuration);
      setPlaying(false);
      setMessage(
        result.playbackUrl
          ? "Preview ready inside the editor."
          : `Preview rendered: ${result.outputPath}`
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
      Math.min(playerDuration || effectiveDuration, seconds)
    );

    if (video) video.currentTime = next;
    setPlayerTime(next);
  };

  const togglePlayback = async () => {
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
          <p className="eyebrow">QUICK PREVIEW</p>
          <h3>Render and scrub the part you want to inspect</h3>
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
            ? `Rendering ${Math.round((progress?.progress ?? 0) * 100)}%...`
            : "Render preview"}
        </button>
      </div>

      <div className="quickPreviewControls">
        <label>
          Start
          <input
            type="range"
            min="0"
            max={Math.max(1, maxStart)}
            step="0.5"
            value={Math.min(start, Math.max(1, maxStart))}
            onChange={(event) => setStart(Number(event.target.value))}
          />
          <strong>{formatTime(start)}</strong>
        </label>

        <label>
          Preview length
          <select
            value={duration}
            onChange={(event) => setDuration(Number(event.target.value))}
          >
            <option value={10}>10 seconds</option>
            <option value={20}>20 seconds</option>
            <option value={30}>30 seconds</option>
            <option value={60}>60 seconds</option>
          </select>
        </label>

        <div className="quickPreviewRange">
          <span>Range</span>
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
        <div className="inAppPlayer">
          <video
            ref={videoRef}
            src={playbackUrl}
            controls
            preload="metadata"
            onLoadedMetadata={(event) => {
              const nextDuration = Number.isFinite(event.currentTarget.duration)
                ? event.currentTarget.duration
                : effectiveDuration;
              setPlayerDuration(nextDuration);
              setPlayerTime(event.currentTarget.currentTime);
            }}
            onTimeUpdate={(event) =>
              setPlayerTime(event.currentTarget.currentTime)
            }
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
          />

          <div className="playerScrubRow">
            <button onClick={() => seek(playerTime - 5)}>−5s</button>
            <button className="primary" onClick={togglePlayback}>
              {playing ? "Pause" : "Play"}
            </button>
            <button onClick={() => seek(playerTime + 5)}>+5s</button>

            <input
              aria-label="Preview scrubber"
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
