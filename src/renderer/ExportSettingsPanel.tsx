import type {
  RenderQuality,
  SubtitlePosition,
  TimelinePlan
} from "../shared/types";

type Props = {
  plan: TimelinePlan;
  onChange: (plan: TimelinePlan) => void;
};

type Preset = {
  id: string;
  label: string;
  width: number;
  height: number;
};

const PRESETS: Preset[] = [
  { id: "1080p", label: "YouTube 1080p · 16:9", width: 1920, height: 1080 },
  { id: "1440p", label: "YouTube 1440p · 16:9", width: 2560, height: 1440 },
  { id: "4k", label: "YouTube 4K · 16:9", width: 3840, height: 2160 },
  { id: "shorts", label: "Shorts / TikTok · 9:16", width: 1080, height: 1920 },
  { id: "square", label: "Square · 1:1", width: 1080, height: 1080 },
  { id: "portrait", label: "Portrait feed · 4:5", width: 1080, height: 1350 }
];

const FONT_SUGGESTIONS = [
  "Noto Sans Thai",
  "Tahoma",
  "Arial",
  "Sarabun",
  "Leelawadee UI"
];

function presetFor(plan: TimelinePlan) {
  return (
    PRESETS.find(
      (preset) =>
        preset.width === plan.width && preset.height === plan.height
    )?.id ?? "custom"
  );
}

function aspectLabel(width: number, height: number) {
  const ratio = width / height;
  const known = [
    { value: 16 / 9, label: "16:9" },
    { value: 9 / 16, label: "9:16" },
    { value: 1, label: "1:1" },
    { value: 4 / 5, label: "4:5" }
  ];

  const match = known.find((item) => Math.abs(item.value - ratio) < 0.01);
  return match?.label ?? `${width}:${height}`;
}

function evenDimension(value: number) {
  const safe = Math.max(240, Math.min(7680, Math.round(value || 0)));
  return safe % 2 === 0 ? safe : safe + 1;
}

export default function ExportSettingsPanel({ plan, onChange }: Props) {
  const currentPreset = presetFor(plan);
  const quality = plan.quality ?? "standard";
  const subtitleStyle = plan.subtitleStyle ?? {
    fontFamily: "",
    scale: 1,
    position: "bottom" as const
  };

  const patch = (patch: Partial<TimelinePlan>) => {
    onChange({ ...plan, ...patch });
  };

  const patchSubtitleStyle = (
    patchStyle: Partial<typeof subtitleStyle>
  ) => {
    patch({
      subtitleStyle: {
        ...subtitleStyle,
        ...patchStyle
      }
    });
  };

  const applyPreset = (id: string) => {
    if (id === "custom") return;
    const preset = PRESETS.find((item) => item.id === id);
    if (!preset) return;
    patch({ width: preset.width, height: preset.height });
  };

  return (
    <section className="exportSettingsPanel">
      <div className="exportSettingsHeader">
        <div>
          <p className="eyebrow">EXPORT SETTINGS</p>
          <h3>Resolution, frame rate, quality, and subtitle delivery</h3>
          <p className="muted">
            Images keep their proportions. The renderer scales and center-crops
            to fill the selected frame instead of stretching the artwork.
          </p>
        </div>

        <div className="exportResolutionBadge">
          <strong>{plan.width}×{plan.height}</strong>
          <span>{aspectLabel(plan.width, plan.height)}</span>
        </div>
      </div>

      <div className="exportSettingsGrid">
        <label>
          Preset
          <select
            value={currentPreset}
            onChange={(event) => applyPreset(event.target.value)}
          >
            {PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
            <option value="custom">Custom size</option>
          </select>
        </label>

        <label>
          Width
          <input
            type="number"
            min="240"
            max="7680"
            step="2"
            value={plan.width}
            onChange={(event) =>
              patch({ width: evenDimension(Number(event.target.value)) })
            }
          />
        </label>

        <label>
          Height
          <input
            type="number"
            min="240"
            max="7680"
            step="2"
            value={plan.height}
            onChange={(event) =>
              patch({ height: evenDimension(Number(event.target.value)) })
            }
          />
        </label>

        <label>
          Frame rate
          <select
            value={plan.fps}
            onChange={(event) => patch({ fps: Number(event.target.value) })}
          >
            <option value={24}>24 fps</option>
            <option value={25}>25 fps</option>
            <option value={30}>30 fps</option>
            <option value={60}>60 fps</option>
          </select>
        </label>

        <label>
          Quality
          <select
            value={quality}
            onChange={(event) =>
              patch({ quality: event.target.value as RenderQuality })
            }
          >
            <option value="draft">Draft · faster / smaller</option>
            <option value="standard">Standard · balanced</option>
            <option value="high">High · slower / cleaner</option>
          </select>
        </label>
      </div>

      <div className="subtitleExportSettings">
        <div>
          <p className="eyebrow">SUBTITLE STYLE</p>
          <strong>Burned captions + optional YouTube-ready SRT</strong>
        </div>

        <div className="subtitleSettingsGrid">
          <label>
            Font family
            <input
              list="subtitle-font-suggestions"
              value={subtitleStyle.fontFamily}
              placeholder="Auto / system fallback"
              onChange={(event) =>
                patchSubtitleStyle({ fontFamily: event.target.value })
              }
            />
            <datalist id="subtitle-font-suggestions">
              {FONT_SUGGESTIONS.map((font) => (
                <option value={font} key={font} />
              ))}
            </datalist>
          </label>

          <label>
            Size
            <select
              value={subtitleStyle.scale}
              onChange={(event) =>
                patchSubtitleStyle({ scale: Number(event.target.value) })
              }
            >
              <option value={0.8}>80%</option>
              <option value={1}>100%</option>
              <option value={1.2}>120%</option>
              <option value={1.4}>140%</option>
              <option value={1.6}>160%</option>
            </select>
          </label>

          <label>
            Position
            <select
              value={subtitleStyle.position}
              onChange={(event) =>
                patchSubtitleStyle({
                  position: event.target.value as SubtitlePosition
                })
              }
            >
              <option value="bottom">Bottom center</option>
              <option value="middle">Middle center</option>
            </select>
          </label>

          <label className="subtitleSidecarToggle">
            <input
              type="checkbox"
              checked={plan.exportSubtitleSidecar ?? false}
              onChange={(event) =>
                patch({ exportSubtitleSidecar: event.target.checked })
              }
            />
            Also export .srt beside MP4
          </label>
        </div>

        <p className="timelineHint">
          Leave the font blank to let the operating system choose a fallback.
          A named font must already be installed on the computer that renders
          the video. The optional SRT uses the same corrected subtitle timing
          and text as the burned captions.
        </p>
      </div>

      <div className="exportPresetNotes">
        <span>4K supported: 3840×2160</span>
        <span>Vertical supported: 1080×1920</span>
        <span>Custom up to 7680 px per side</span>
        <span>
          {quality === "high"
            ? "High-quality encode"
            : quality === "draft"
              ? "Fast draft encode"
              : "Balanced encode"}
        </span>
      </div>

      <p className="timelineHint">
        Exporting above the source-image resolution will upscale the image, so
        the MP4 can be 4K even when the original artwork is smaller, but it
        cannot invent true source detail.
      </p>
    </section>
  );
}
