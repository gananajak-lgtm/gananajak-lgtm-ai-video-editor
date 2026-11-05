import { useState } from "react";
import type { AudioLayer, AudioLayerKind } from "../shared/types";

type Props = {
  layers: AudioLayer[];
  onChange: (layers: AudioLayer[]) => void;
  timelineDuration?: number;
};

function fileName(filePath: string) {
  return filePath.split(/[\\/]/).pop() ?? filePath;
}

export default function AudioLayersPanel({ layers, onChange, timelineDuration }: Props) {
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState("");
  const [timingWarning, setTimingWarning] = useState<string | null>(null);
  const pageSize = 25;
  const matching = layers.filter(layer => (layer.voiceLineId ?? layer.label ?? "").toLowerCase().includes(filter.toLowerCase()) || fileName(layer.filePath).toLowerCase().includes(filter.toLowerCase()));
  const currentPage = Math.min(page, Math.max(0, Math.ceil(matching.length / pageSize) - 1));
  const addAudio = async () => {
    const assets = await window.videoEditor.selectAudioLayers();
    if (!assets.length) return;

    const next: AudioLayer[] = assets.map((asset) => ({
      id: asset.id,
      filePath: asset.filePath,
      kind: "sfx",
      start: 0,
      duration: asset.duration,
      volume: 0.8,
      loop: false,
      fadeIn: 0,
      fadeOut: 0
    }));

    onChange([...layers, ...next]);
  };

  const patchLayer = (id: string, patch: Partial<AudioLayer>) => {
    const target = layers.find(layer => layer.id === id);
    if (!target) return;
    const candidate = { ...target, ...patch };
    if (target.origin === "studio-dialogue" && patch.start !== undefined) {
      const overlap = layers.find(other =>
        other.id !== id && other.origin === "studio-dialogue" &&
        candidate.start < other.start + other.duration - 0.001 &&
        candidate.start + candidate.duration > other.start + 0.001
      );
      if (overlap) {
        setTimingWarning("ไม่สามารถขยับเสียงไปทับเสียง " + (overlap.voiceLineId ?? overlap.label ?? "") + " ได้");
        return;
      }
    }
    setTimingWarning(null);
    onChange(layers.map(layer => layer.id === id ? candidate : layer));
  };

  const removeLayer = (id: string) => {
    const layer = layers.find((item) => item.id === id);
    if (!layer || !window.confirm(`ลบแทร็กเสียง “${fileName(layer.filePath)}” ออกจากโปรเจกต์?\\nไฟล์เสียงต้นฉบับจะไม่ถูกลบ`)) return;
    onChange(layers.filter((item) => item.id !== id));
  };

  return (
    <section className="audioLayersPanel">
      <div className="audioLayersHeader">
        <div>
          <p className="eyebrow">ระบบเสียงหลายแทร็ก</p>
          <h3>เสียงบรรยาย + เอฟเฟกต์ + เสียงบรรยากาศ + ดนตรี</h3>
          <p className="muted">
            สามารถวางเสียงหลายแทร็กซ้อนกับเสียงบรรยาย และผสมเสียงทั้งหมดเมื่อส่งออกวิดีโอ
          </p>
        </div>
        <button onClick={addAudio}>เพิ่มแทร็กเสียง</button>
      </div>

      {layers.length === 0 ? (
        <div className="emptyAudioLayers">
          ยังไม่มีแทร็กเสียงเพิ่มเติม โดยเสียงบรรยายเป็นแทร็กหลัก
        </div>
      ) : (
        <div className="audioLayerList">
          <label>ค้นหาเสียงหรือเลขบรรทัด <input value={filter} onChange={event => { setFilter(event.target.value); setPage(0); }} placeholder="ค้นหา..." /></label>
          <div className="editorMediaPager"><button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>ก่อนหน้า</button><span>รายการ {matching.length ? currentPage * pageSize + 1 : 0}–{Math.min(matching.length, (currentPage + 1) * pageSize)} จาก {matching.length}</span><button type="button" disabled={(currentPage + 1) * pageSize >= matching.length} onClick={() => setPage(currentPage + 1)}>ถัดไป</button></div>
          {timingWarning && <p role="alert">{timingWarning}</p>}
          {matching.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map((layer) => (
            <div className="audioLayerRow" key={layer.id}>
              <div className="audioLayerName">
                <strong>{fileName(layer.filePath)}</strong>
                <small>{layer.duration.toFixed(1)}s ต้นฉบับ</small>
              </div>

              <label>
                ประเภท
                <select
                  value={layer.kind}
                  onChange={(event) =>
                    patchLayer(layer.id, {
                      kind: event.target.value as AudioLayerKind
                    })
                  }
                >
                  <option value="dialogue">เสียงตัวละคร</option>
                  <option value="sfx">SFX</option>
                  <option value="ambience">เสียงบรรยากาศ</option>
                  <option value="music">ดนตรี</option>
                </select>
              </label>

              <label>
                เริ่มต้น (วินาที)
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={layer.start}
                  onChange={(event) =>
                    patchLayer(layer.id, {
                      start: Math.max(0, Number(event.target.value) || 0)
                    })
                  }
                />
              </label>

              {layer.origin === "studio-dialogue" && <label>
                ลากปรับตำแหน่งเสียง (วินาที)
                <input type="range" min="0" max={Math.max(0.1, (timelineDuration ?? Math.max(...layers.map(item => item.start + item.duration), 1)) - layer.duration)} step="0.1" value={layer.start} onChange={event => patchLayer(layer.id, { start: Math.max(0, Number(event.target.value)) })} />
              </label>}
              {layer.origin === "studio-dialogue" && <div className="editorMediaPager">
                <button type="button" onClick={() => patchLayer(layer.id, { start: Math.max(0, Math.round((layer.start - 0.1) * 100) / 100) })}>◀ 0.1 วิ</button>
                <span>{layer.voiceLineId ?? layer.label ?? "เสียงตัวละคร"} · {layer.start.toFixed(2)} วินาที</span>
                <button type="button" onClick={() => patchLayer(layer.id, { start: Math.round((layer.start + 0.1) * 100) / 100 })}>0.1 วิ ▶</button>
              </div>}
              <label>
                ระดับเสียง
                <input
                  type="number"
                  min="0"
                  max="2"
                  step="0.05"
                  value={layer.volume}
                  onChange={(event) =>
                    patchLayer(layer.id, {
                      volume: Math.max(0, Number(event.target.value) || 0)
                    })
                  }
                />
              </label>

              <label className="loopLabel">
                <input
                  type="checkbox"
                  checked={layer.loop}
                  onChange={(event) =>
                    patchLayer(layer.id, { loop: event.target.checked })
                  }
                />
                เล่นวน
              </label>

              <button className="removeButton" onClick={() => removeLayer(layer.id)}>
                ลบ
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
