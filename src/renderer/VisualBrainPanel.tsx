import { useEffect, useState } from "react";
import type {
  EditingBrainPlan,
  TimelinePlan,
  VisualBrainPlan
} from "../shared/types";

type Props = {
  images: string[];
  narration: string | null;
  editingPlan: EditingBrainPlan | null;
  onTimelineReady: (
    timeline: TimelinePlan,
    visualPlan: VisualBrainPlan
  ) => void;
};

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

export default function VisualBrainPanel({
  images,
  narration,
  editingPlan,
  onTimelineReady
}: Props) {
  const [plan, setPlan] = useState<VisualBrainPlan | null>(null);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPlan(null);
    setError(null);
  }, [images, editingPlan]);

  const buildVisualPlan = async () => {
    if (!editingPlan || !narration || images.length === 0) return;

    setBuilding(true);
    setError(null);

    try {
      const visualPlan = await window.videoEditor.buildVisualBrainPlan(
        editingPlan.scenes,
        images
      );
      const timeline =
        await window.videoEditor.buildTimelineFromVisualPlan(
          narration,
          visualPlan
        );

      setPlan(visualPlan);
      onTimelineReady(timeline, visualPlan);
    } catch (buildError) {
      setError(
        buildError instanceof Error
          ? buildError.message
          : String(buildError)
      );
    } finally {
      setBuilding(false);
    }
  };

  const ready =
    Boolean(editingPlan) && Boolean(narration) && images.length > 0;

  return (
    <section className="visualBrainPanel">
      <div className="visualBrainHeader">
        <div>
          <p className="eyebrow">VISUAL BRAIN</p>
          <h3>Understand images, match scenes, then cut the timeline</h3>
          <p className="muted">
            Each image is analyzed for visible characters, actions, setting,
            mood, and framing. The results are cached locally, then matched to
            grouped story scenes and converted into deliberate shots.
          </p>
        </div>

        <button
          className="primary"
          disabled={!ready || building}
          onClick={buildVisualPlan}
        >
          {building
            ? "Analyzing images + planning shots..."
            : plan
              ? "Rebuild Visual Brain plan"
              : "Build Visual Brain plan"}
        </button>
      </div>

      <div className="visualStats">
        <span>{images.length} story images</span>
        <span>{editingPlan?.scenes.length ?? 0} grouped scenes</span>
        <span>{plan?.descriptors.length ?? 0} analyzed images</span>
        <span>{plan?.shots.length ?? 0} planned shots</span>
      </div>

      {!editingPlan && (
        <div className="visualWaiting">
          Build the Editing Brain plan first so Visual Brain has stable scene
          blocks to work from.
        </div>
      )}

      {error && <div className="brainError">{error}</div>}

      {plan && (
        <div className="visualResults">
          <div className="descriptorPreview">
            <div className="brainSectionTitle">
              <strong>Image understanding</strong>
              <small>Cached until the source image changes</small>
            </div>

            {plan.descriptors.slice(0, 12).map((descriptor) => (
              <div className="descriptorRow" key={descriptor.id}>
                <strong>{fileName(descriptor.filePath)}</strong>
                <p>{descriptor.summary}</p>
                <div className="descriptorTags">
                  <span>{descriptor.shotType}</span>
                  {descriptor.actions.slice(0, 2).map((action) => (
                    <span key={action}>{action}</span>
                  ))}
                  {descriptor.setting.slice(0, 2).map((setting) => (
                    <span key={setting}>{setting}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="shotPreview">
            <div className="brainSectionTitle">
              <strong>Automatic shot plan</strong>
              <small>Scene timestamps become real cut points</small>
            </div>

            {plan.shots.slice(0, 18).map((shot) => (
              <div className="plannedShotRow" key={shot.id}>
                <span>
                  {formatTime(shot.start)} · {shot.duration.toFixed(1)}s
                </span>
                <strong>{fileName(shot.imagePath)}</strong>
                <p>{shot.reason}</p>
                <small>{shot.motion}</small>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="timelineHint">
        The generated visual timeline preserves narration timing. Pauses between
        spoken scenes hold the current image instead of forcing unnecessary
        cuts.
      </p>
    </section>
  );
}
