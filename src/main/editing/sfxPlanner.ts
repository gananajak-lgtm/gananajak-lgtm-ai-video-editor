import path from "node:path";
import type {
  AudioAsset,
  AudioLayer,
  SfxCue,
  TranscriptResult
} from "../../shared/types";

type CueRule = {
  label: string;
  triggers: string[];
  assetTerms: string[];
  volume: number;
};

const RULES: CueRule[] = [
  {
    label: "gunshot",
    triggers: ["ปืน", "ยิง", "กระสุน", "gun", "shot", "ยิงปืน"],
    assetTerms: ["gun", "shot", "gunshot", "ปืน", "ยิง"],
    volume: 0.78
  },
  {
    label: "footsteps",
    triggers: ["ฝีเท้า", "เดิน", "วิ่ง", "ก้าว", "footstep", "steps", "running"],
    assetTerms: ["footstep", "steps", "walk", "run", "ฝีเท้า", "เดิน"],
    volume: 0.5
  },
  {
    label: "thunder",
    triggers: ["ฟ้าร้อง", "สายฟ้า", "ฟ้าผ่า", "thunder", "lightning"],
    assetTerms: ["thunder", "lightning", "ฟ้าร้อง", "ฟ้าผ่า"],
    volume: 0.72
  },
  {
    label: "rain",
    triggers: ["ฝน", "สายฝน", "rain", "storm"],
    assetTerms: ["rain", "storm", "ฝน"],
    volume: 0.38
  },
  {
    label: "wind",
    triggers: ["ลม", "ลมพัด", "วายุ", "wind", "gust"],
    assetTerms: ["wind", "gust", "ลม"],
    volume: 0.36
  },
  {
    label: "door",
    triggers: ["ประตู", "เปิดประตู", "ปิดประตู", "door"],
    assetTerms: ["door", "ประตู"],
    volume: 0.62
  },
  {
    label: "scream",
    triggers: ["กรีดร้อง", "ร้องลั่น", "เสียงร้อง", "scream", "shriek"],
    assetTerms: ["scream", "shriek", "กรีดร้อง", "เสียงร้อง"],
    volume: 0.66
  },
  {
    label: "growl",
    triggers: ["คำราม", "ขู่คำราม", "growl", "roar"],
    assetTerms: ["growl", "roar", "คำราม"],
    volume: 0.62
  },
  {
    label: "water",
    triggers: ["แม่น้ำ", "ลำธาร", "สายน้ำ", "น้ำไหล", "river", "stream", "water"],
    assetTerms: ["river", "stream", "water", "แม่น้ำ", "ลำธาร", "น้ำ"],
    volume: 0.34
  },
  {
    label: "fire",
    triggers: ["ไฟ", "เปลวไฟ", "เผา", "กองไฟ", "fire", "flame"],
    assetTerms: ["fire", "flame", "ไฟ", "กองไฟ"],
    volume: 0.34
  },
  {
    label: "explosion",
    triggers: ["ระเบิด", "ระเบิดดัง", "explosion", "blast"],
    assetTerms: ["explosion", "blast", "ระเบิด"],
    volume: 0.82
  },
  {
    label: "birds",
    triggers: ["นก", "เสียงนก", "birds", "bird"],
    assetTerms: ["bird", "birds", "นก"],
    volume: 0.3
  }
];

function normalize(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findAsset(rule: CueRule, assets: AudioAsset[]) {
  return assets.find((asset) => {
    const name = normalize(path.basename(asset.filePath));
    return rule.assetTerms.some((term) => name.includes(normalize(term)));
  });
}

export function planSoundEffects(
  transcript: TranscriptResult,
  assets: AudioAsset[]
): { cues: SfxCue[]; layers: AudioLayer[] } {
  const cues: SfxCue[] = [];
  const layers: AudioLayer[] = [];
  const lastCueByLabel = new Map<string, number>();

  for (const segment of transcript.segments) {
    const normalizedText = normalize(segment.text);

    for (const rule of RULES) {
      if (
        !rule.triggers.some((trigger) =>
          normalizedText.includes(normalize(trigger))
        )
      ) {
        continue;
      }

      const previousStart = lastCueByLabel.get(rule.label);
      if (
        previousStart !== undefined &&
        segment.start - previousStart < 1.5
      ) {
        continue;
      }

      const asset = findAsset(rule, assets);
      const cue: SfxCue = {
        id: `sfx-cue-${cues.length + 1}`,
        label: rule.label,
        start: segment.start,
        triggerText: segment.text.trim(),
        matchedAssetId: asset?.id ?? null,
        matchedFilePath: asset?.filePath ?? null
      };

      cues.push(cue);
      lastCueByLabel.set(rule.label, segment.start);

      if (asset) {
        layers.push({
          id: `auto-sfx-${layers.length + 1}-${Date.now()}`,
          filePath: asset.filePath,
          kind: "sfx",
          start: segment.start,
          duration: Math.min(asset.duration, 6),
          volume: rule.volume,
          loop: false,
          fadeIn: 0,
          fadeOut: Math.min(0.25, asset.duration / 4),
          origin: "auto-sfx",
          label: rule.label
        });
      }
    }
  }

  return { cues, layers };
}
