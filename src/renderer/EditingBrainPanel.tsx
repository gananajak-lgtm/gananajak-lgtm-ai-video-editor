import { useEffect, useState } from "react";
import type {
  AudioAsset,
  AudioLayer,
  EditingBrainPlan,
  TranscriptResult
} from "../shared/types";

type Props = {
  transcript: TranscriptResult | null;
  onApplyAutoLayers: (layers: AudioLayer[]) => void;
  onPlanChange: (plan: EditingBrainPlan | null) => void;
};

function fileName(filePath: string) {
  return filePath.split(/[\\/]/).pop() ?? filePath;
}

function formatTime(seconds: number) {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const remainder = safe - minutes * 60;
  return `${String(minutes).padStart(2, "0")}:${remainder.toFixed(1).padStart(4, "0")}`;
}

export default function EditingBrainPanel({
  transcript,
  onApplyAutoLayers,
  onPlanChange
}: Props) {
  const [sfxLibrary, setSfxLibrary] = useState<AudioAsset[]>([]);
  const [plan, setPlan] = useState<EditingBrainPlan | null>(null);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPlan(null);
    onPlanChange(null);
    setError(null);
  }, [transcript, onPlanChange]);

  const importSfxLibrary = async () => {
    const assets = await window.videoEditor.selectAudioLayers();
    if (!assets.length) return;

    setSfxLibrary((current) => {
      const known = new Set(current.map((asset) => asset.filePath));
      return [
        ...current,
        ...assets.filter((asset) => !known.has(asset.filePath))
      ];
    });
    setPlan(null);
    onPlanChange(null);
    setError(null);
  };

  const buildPlan = async () => {
    if (!transcript) return;

    setBuilding(true);
    setError(null);

    try {
      const next = await window.videoEditor.buildEditingBrainPlan(
        transcript,
        sfxLibrary
      );
      setPlan(next);
      onPlanChange(next);
      onApplyAutoLayers(next.automaticAudioLayers);
    } catch (buildError) {
      setError(buildError instanceof Error ? buildError.message : String(buildError));
    } finally {
      setBuilding(false);
    }
  };

  const matchedCount =
    plan?.sfxCues.filter((cue) => cue.matchedFilePath !== null).length ?? 0;

  return (
    <section className="editingBrainPanel">
      <div className="editingBrainHeader">
        <div>
          <p className="eyebrow">ระบบวางแผนตัดต่อ</p>
          <h3>จัดกลุ่มฉากและวางเอฟเฟกต์เสียงอัตโนมัติ</h3>
          <p className="muted">
            จัดบทบรรยายเป็นฉากต่อเนื่องเพื่อไม่ให้ตัดภาพทุกประโยค พร้อมค้นหาจังหวะเอฟเฟกต์เสียงและจับคู่กับคลังเสียงในเครื่อง
          </p>
        </div>
        <div className="editingBrainActions">
          <button onClick={importSfxLibrary}>นำเข้าคลังเอฟเฟกต์</button>
          <button
            className="primary"
            disabled={!transcript || building}
            onClick={buildPlan}
          >
            {building ? "กำลังวางแผน..." : "สร้างแผนตัดต่อ"}
          </button>
        </div>
      </div>

      <div className="brainStats">
        <span>{sfxLibrary.length} ไฟล์เอฟเฟกต์</span>
        <span>{plan?.scenes.length ?? 0} ฉากที่จัดกลุ่ม</span>
        <span>{plan?.sfxCues.length ?? 0} จุดเอฟเฟกต์ที่พบ</span>
        <span>{matchedCount} เสียงที่จับคู่แล้ว</span>
      </div>

      {sfxLibrary.length > 0 && (
        <div className="sfxLibraryStrip">
          {sfxLibrary.slice(0, 8).map((asset) => (
            <span key={asset.id} title={asset.filePath}>
              {fileName(asset.filePath)}
            </span>
          ))}
          {sfxLibrary.length > 8 && <span>+{sfxLibrary.length - 8} เพิ่มเติม</span>}
        </div>
      )}

      {error && <div className="brainError">{error}</div>}

      {plan && (
        <div className="brainResults">
          <div className="scenePreview">
            <div className="brainSectionTitle">
              <strong>ฉากในเรื่อง</strong>
              <small>ระยะเวลาช็อตขั้นต่ำ 3.5 วินาที</small>
            </div>

            {plan.scenes.slice(0, 12).map((scene) => (
              <div className="sceneRow" key={scene.id}>
                <span>
                  {formatTime(scene.start)} → {formatTime(scene.end)}
                </span>
                <p>{scene.text}</p>
                <small>
                  {scene.duration.toFixed(1)}s · {scene.recommendedShotCount} recommended shot{scene.recommendedShotCount === 1 ? "" : "s"}
                </small>
              </div>
            ))}
          </div>

          <div className="sfxCuePreview">
            <div className="brainSectionTitle">
              <strong>Automatic SFX cues</strong>
              <small>Matched sounds are placed directly on the multitrack timeline</small>
            </div>

            {plan.sfxCues.length === 0 ? (
              <div className="emptyBrainResult">
                No sound-effect cues detected in this transcript yet.
              </div>
            ) : (
              plan.sfxCues.slice(0, 16).map((cue) => (
                <div
                  className={cue.matchedFilePath ? "sfxCueRow matchedCue" : "sfxCueRow"}
                  key={cue.id}
                >
                  <span>{formatTime(cue.start)}</span>
                  <strong>{cue.label}</strong>
                  <p>{cue.triggerText}</p>
                  <small>
                    {cue.matchedFilePath
                      ? fileName(cue.matchedFilePath)
                      : "No matching local SFX file"}
                  </small>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <p className="timelineHint">
        This is the first automatic editing layer. The next Visual Brain step will use these ฉากที่จัดกลุ่ม to decide which image to hold, when to cut, and which image best matches each scene.
      </p>
    </section>
  );
}
