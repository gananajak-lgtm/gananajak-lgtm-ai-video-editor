import type { AudioLayer, AudioLayerKind } from "../shared/types";

type Props = {
  layers: AudioLayer[];
  onChange: (layers: AudioLayer[]) => void;
};

function fileName(filePath: string) {
  return filePath.split(/[\\/]/).pop() ?? filePath;
}

export default function AudioLayersPanel({ layers, onChange }: Props) {
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
    onChange(
      layers.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer))
    );
  };

  const removeLayer = (id: string) => {
    onChange(layers.filter((layer) => layer.id !== id));
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
          {layers.map((layer) => (
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
