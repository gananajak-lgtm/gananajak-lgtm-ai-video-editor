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
          <p className="eyebrow">MULTITRACK AUDIO</p>
          <h3>Narration + SFX + ambience + music</h3>
          <p className="muted">
            Extra audio can overlap the narration at any timestamp and will be mixed during export.
          </p>
        </div>
        <button onClick={addAudio}>Add audio layer</button>
      </div>

      {layers.length === 0 ? (
        <div className="emptyAudioLayers">
          No extra layers yet. Narration remains the main voice track.
        </div>
      ) : (
        <div className="audioLayerList">
          {layers.map((layer) => (
            <div className="audioLayerRow" key={layer.id}>
              <div className="audioLayerName">
                <strong>{fileName(layer.filePath)}</strong>
                <small>{layer.duration.toFixed(1)}s source</small>
              </div>

              <label>
                Type
                <select
                  value={layer.kind}
                  onChange={(event) =>
                    patchLayer(layer.id, {
                      kind: event.target.value as AudioLayerKind
                    })
                  }
                >
                  <option value="sfx">SFX</option>
                  <option value="ambience">Ambience</option>
                  <option value="music">Music</option>
                </select>
              </label>

              <label>
                Start (s)
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
                Volume
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
                Loop
              </label>

              <button className="removeButton" onClick={() => removeLayer(layer.id)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
