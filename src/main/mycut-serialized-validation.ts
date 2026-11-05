import { assertMyCutContinuousVisualCuts, assertMyCutVoiceTimeline } from "../shared/mycut-image-cuts";

type SerializedClip = { id?: string; kind?: string; track: string; mediaId: string; path: string; start: number; dur: number };
type SerializedMedia = { id: string; kind?: string; path: string };
export function assertSerializedMyCutTimeline(project: { clips: SerializedClip[]; media: SerializedMedia[]; dur: number }): void {
  if (!Number.isFinite(project.dur) || project.dur <= 0 || !Array.isArray(project.clips) || !Array.isArray(project.media)) {
    throw new Error("Invalid serialized MyCut timeline");
  }
  const ids = new Map(project.media.map(item => [item.id, item.path]));
  if (ids.size !== project.media.length || project.media.some(item => !item.id || !item.path) || project.clips.some(clip =>
    !ids.has(clip.mediaId) || ids.get(clip.mediaId) !== clip.path ||
    !Number.isFinite(clip.start) || clip.start < 0 ||
    !Number.isFinite(clip.dur) || clip.dur <= 0 ||
    clip.start + clip.dur > project.dur + 1e-7
  )) throw new Error("Invalid serialized MyCut media references or clip bounds");
  const clipIds = project.clips.map(clip => clip.id);
  if (clipIds.some(id => !id) || new Set(clipIds).size !== clipIds.length) {
    throw new Error("Invalid serialized MyCut duplicate or missing clip IDs");
  }
  const mediaById = new Map(project.media.map(item => [item.id, item]));
  if (project.clips.some(clip => {
    const expectedKind = clip.track === "A1" ? "audio" : clip.track === "V1" ? "image" : null;
    const mediaKind = mediaById.get(clip.mediaId)?.kind;
    return expectedKind !== null &&
      (clip.kind !== expectedKind || mediaKind !== expectedKind);
  })) throw new Error("Invalid serialized MyCut track/media kind mismatch");
  const a = project.clips.filter(clip => clip.track === "A1").sort((x,y) => x.start-y.start);
  const v = project.clips.filter(clip => clip.track === "V1").sort((x,y) => x.start-y.start);
  if (a.length + v.length !== project.clips.length || !a.length) throw new Error("Invalid MyCut track assignment");
  assertMyCutVoiceTimeline(a.map(c=>c.start), a.map(c=>c.dur), project.dur, 0.3);
  if (v.length) {
    for (let i = 1; i < v.length; i++) {
      if (Math.abs(v[i].start - (v[i-1].start + v[i-1].dur)) > 1e-7) {
        throw new Error("Invalid serialized MyCut V1 gap or overlap");
      }
    }
    assertMyCutContinuousVisualCuts([v[0].start, ...v.map(c => c.start + c.dur)], project.dur);
  }
}
