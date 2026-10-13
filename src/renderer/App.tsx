import { scheduleDialogueClips } from "./dialogue-timeline";
import { holdFramesThroughDialogue, restoreFrameAnchors } from "./visual-hold";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ContentProject } from "../shared/content-factory";
import type { AudioLayer, AiSettingsStatus, EditingBrainPlan, FullEpisodeTestReport, ProjectDocument, ProjectLoadResult, ProjectRelinkResult, StudioProject, RenderProgress, TimelinePlan, TranscriptResult, VisualBrainPlan } from "../shared/types";
import AudioLayersPanel from "./AudioLayersPanel";
import EditingBrainPanel from "./EditingBrainPanel";
import VisualBrainPanel from "./VisualBrainPanel";
import TimelineEditor from "./TimelineEditor";
import ProjectToolbar from "./ProjectToolbar";
import ExportSettingsPanel from "./ExportSettingsPanel";
import MediaRelinkPanel from "./MediaRelinkPanel";
import EpisodeReadinessPanel from "./EpisodeReadinessPanel";
import QuickPreviewPanel from "./QuickPreviewPanel";
import EpisodeQcPackPanel from "./EpisodeQcPackPanel";
import FullEpisodeTestPanel from "./FullEpisodeTestPanel";
import VoiceStudioPanel from "./VoiceStudioPanel";
import ElevenLabsSettingsPanel from "./ElevenLabsSettingsPanel";
import CharacterVoiceLibrary from "./CharacterVoiceLibrary";

const providerStatusLabel: Record<string, string> = {
  missing_key: "ยังไม่ได้ตั้งค่า API Key",
  connected: "เชื่อมต่อสำเร็จ",
  unauthorized: "คีย์ไม่ถูกต้องหรือไม่มีสิทธิ์เข้าถึง",
  rate_limited: "ถูกจำกัดคำขอชั่วคราว",
  network_error: "เครือข่ายขัดข้องหรือหมดเวลา",
  provider_error: "บริการตอบกลับข้อผิดพลาด"
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

export default function App() {
  const [projectId, setProjectId] = useState(() => `project-${Date.now()}`);
  const episodeEditorRef = useRef<{ projectId: string; episodeId: string } | null>(null);
  const autosaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const autosaveGenerationRef = useRef(0);
  const queueEpisodeSave = (projectId: string, episodeId: string, document: ProjectDocument) => {
    const queued = autosaveQueueRef.current.catch(() => undefined).then(() => window.videoEditor.saveStudioEpisodeEditor(projectId, episodeId, document));
    autosaveQueueRef.current = queued;
    return queued;
  };
  const [episodeEditorScope, setEpisodeEditorScope] = useState<{ projectId: string; episodeId: string } | null>(null);
  const [projectTitle, setProjectTitle] = useState("เรื่องไม่มีชื่อ");
  const [projectCreatedAt, setProjectCreatedAt] = useState(
    () => new Date().toISOString()
  );
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [autosaveState, setAutosaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [sessionReady, setSessionReady] = useState(false);
  const [missingMedia, setMissingMedia] = useState<string[]>([]);
  const [relinking, setRelinking] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [narration, setเสียงบรรยาย] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TimelinePlan | null>(null);
  const [studioFrameAnchors, setStudioFrameAnchors] = useState<Record<string, string>>({});
  const [transcript, setTranscript] = useState<TranscriptResult | null>(null);
  const [editingPlan, setEditingPlan] = useState<EditingBrainPlan | null>(null);
  const [audioLayers, setAudioLayers] = useState<AudioLayer[]>([]);
  const [aiSfxEnabled, setAiSfxEnabled] = useState(false);
  const [contentProject, setContentProject] = useState<ContentProject | null>(null);
  const [aiStatus, setAiStatus] = useState<AiSettingsStatus>({
    configured: false,
    persistedSecurely: false
  });
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [checkingProvider, setCheckingProvider] = useState<"openai" | "elevenlabs" | null>(null);
  const [providerResults, setProviderResults] = useState<Record<string, string>>({});
  const [transcribing, setTranscribing] = useState(false);
  const [building, setBuilding] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState<RenderProgress | null>(null);
  const [renderHistory, setRenderHistory] = useState<FullEpisodeTestReport[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applyLoadedProject = (loaded: ProjectLoadResult) => {
    const project = loaded.project;
    setProjectId(project.id);
    setProjectTitle(project.title);
    setProjectCreatedAt(project.createdAt);
    setProjectPath(loaded.filePath);
    setImages(project.images);
    setเสียงบรรยาย(project.narration);
    setTranscript(project.transcript);
    setEditingPlan(project.editingPlan);
    setTimeline(
      project.timeline
        ? {
            ...project.timeline,
            quality: project.timeline.quality ?? "standard"
          }
        : null
    );
    setAudioLayers(project.audioLayers);
    setStudioFrameAnchors(restoreFrameAnchors(
      project.studioFrameAnchors,
      project.timeline?.clips.map(clip => clip.id) ?? [],
      project.audioLayers.some(layer => layer.origin === "studio-dialogue" && Boolean(layer.voiceLineId))
        ? project.audioLayers.filter(layer => layer.origin === "studio-dialogue" && Boolean(layer.voiceLineId)).map(layer => layer.voiceLineId!)
        : undefined
    ));
    setAiSfxEnabled(project.aiSfxEnabled ?? false);
    setContentProject(project.contentProject ?? null);
    setRenderHistory(project.renderHistory ?? []);
    setMissingMedia(loaded.missingMedia);

    if (loaded.missingMedia.length > 0) {
      setNotice(
        `Project restored with ${loaded.missingMedia.length} missing media file${loaded.missingMedia.length === 1 ? "" : "s"}. Replace those files before export.`
      );
    } else {
      setNotice(
        loaded.filePath
          ? "เปิดโปรเจกต์แล้ว"
          : "กู้คืนโปรเจกต์ที่บันทึกอัตโนมัติล่าสุดแล้ว"
      );
    }
    setError(null);
  };

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      window.videoEditor.getAiSettingsStatus(),
      window.videoEditor.loadAutosaveProject()
    ])
      .then(([status, autosave]) => {
        if (cancelled) return;
        setAiStatus(status);
        if (autosave) {
          // The global autosave belongs only to the standalone editor. It is
          // never interpreted as an episode timeline; those load explicitly.
          applyLoadedProject(autosave);
          setNotice("กู้คืนงานตัดต่อทั่วไปแล้ว · หากต้องการไทม์ไลน์ของ EP ให้เปิดจากรายการตอนใน AI Voice Studio");
        }
      })
      .catch((startupError) => {
        if (cancelled) return;
        setError(
          startupError instanceof Error
            ? startupError.message
            : String(startupError)
        );
      })
      .finally(() => {
        if (!cancelled) setSessionReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return window.videoEditor.onRenderProgress(setRenderProgress);
  }, []);

  const projectDocument = useMemo<ProjectDocument>(
    () => ({
      schemaVersion: 1,
      id: projectId,
      title: projectTitle.trim() || "เรื่องไม่มีชื่อ",
      createdAt: projectCreatedAt,
      updatedAt: new Date().toISOString(),
      images,
      narration,
      transcript,
      editingPlan,
      timeline,
      audioLayers,
      aiSfxEnabled,
      studioFrameAnchors,
      contentProject,
      renderHistory
    }),
    [
      projectId,
      projectTitle,
      projectCreatedAt,
      images,
      narration,
      transcript,
      editingPlan,
      timeline,
      audioLayers,
      aiSfxEnabled,
      studioFrameAnchors,
      contentProject,
      renderHistory
    ]
  );

  const hasProjectContent =
    contentProject !== null ||
    images.length > 0 ||
    narration !== null ||
    transcript !== null ||
    timeline !== null ||
    audioLayers.length > 0;

  useEffect(() => {
    const generation = ++autosaveGenerationRef.current;
    if (!sessionReady || !hasProjectContent) return;

    const target = episodeEditorScope;
    // Bind each scheduled snapshot to its original editor scope. A timer from
    // another episode must never write its stale document into the new episode.
    if (target && projectDocument.id !== "episode-" + target.episodeId) return;
    setAutosaveState("saving");
    const timer = window.setTimeout(() => {
      if (autosaveGenerationRef.current !== generation ||
          episodeEditorRef.current?.episodeId !== target?.episodeId ||
          episodeEditorRef.current?.projectId !== target?.projectId) return;
      const save = target
        ? queueEpisodeSave(target.projectId, target.episodeId, projectDocument)
        : window.videoEditor.autosaveProject(projectDocument);
      void save.then(() => {
        if (autosaveGenerationRef.current === generation) setAutosaveState("saved");
      }).catch(() => {
        if (autosaveGenerationRef.current === generation) setAutosaveState("error");
      });
    }, 800);

    return () => {
      window.clearTimeout(timer);
      if (autosaveGenerationRef.current === generation) ++autosaveGenerationRef.current;
    };
  }, [sessionReady, hasProjectContent, projectDocument, episodeEditorScope]);

  const openProjectFile = async () => {
    setError(null);

    try {
      const loaded = await window.videoEditor.openProject();
      if (loaded) {
        applyLoadedProject(loaded);
        setAutosaveState("saved");
      }
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : String(openError));
    }
  };

  const applyRelinkResult = (result: ProjectRelinkResult) => {
    const project = result.project;
    setImages(project.images);
    setเสียงบรรยาย(project.narration);
    setTranscript(project.transcript);
    setEditingPlan(project.editingPlan);
    setTimeline(
      project.timeline
        ? {
            ...project.timeline,
            quality: project.timeline.quality ?? "standard"
          }
        : null
    );
    setAudioLayers(project.audioLayers);
    setAiSfxEnabled(project.aiSfxEnabled ?? false);
    setRenderHistory(project.renderHistory ?? renderHistory);
    setMissingMedia(result.missingMedia);
    setNotice(
      result.relinked.length > 0
        ? `Relinked ${result.relinked.length} media file${result.relinked.length === 1 ? "" : "s"}. ${result.missingMedia.length} still missing.`
        : "No uniquely matching media files were found in that location."
    );
    setError(null);
  };

  const relinkFromFolder = async () => {
    if (!missingMedia.length) return;

    setRelinking(true);
    setError(null);
    try {
      const result = await window.videoEditor.relinkMissingMediaFromFolder(
        projectDocument,
        missingMedia
      );
      if (result) applyRelinkResult(result);
    } catch (relinkError) {
      setError(
        relinkError instanceof Error ? relinkError.message : String(relinkError)
      );
    } finally {
      setRelinking(false);
    }
  };

  const relinkSingle = async (missingPath: string) => {
    setRelinking(true);
    setError(null);
    try {
      const result = await window.videoEditor.relinkSingleMedia(
        projectDocument,
        missingPath
      );
      if (result) applyRelinkResult(result);
    } catch (relinkError) {
      setError(
        relinkError instanceof Error ? relinkError.message : String(relinkError)
      );
    } finally {
      setRelinking(false);
    }
  };

  const saveProjectFile = async () => {
    setError(null);

    try {
      const saved = await window.videoEditor.saveProject(
        projectDocument,
        projectPath
      );
      if (!saved) return;

      setProjectPath(saved.filePath);
      setAutosaveState("saved");
      setNotice(`Project saved: ${saved.filePath}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    }
  };

  const ready = images.length > 0 && narration !== null;
  const summary = useMemo(() => {
    if (!images.length) return "ยังไม่ได้เลือกภาพ";
    return images.length === 1 ? "1 ภาพที่เลือก" : `${images.length} ภาพที่เลือก`;
  }, [images]);

  const chooseImages = async () => {
    const picked = await window.videoEditor.selectImages();
    if (picked.length) {
      setImages(picked);
      setTimeline(null);
      setStudioFrameAnchors({});
      setNotice(null);
      setError(null);
    }
  };

  const chooseเสียงบรรยาย = async () => {
    const picked = await window.videoEditor.selectNarration();
    if (picked) {
      setเสียงบรรยาย(picked);
      setTranscript(null);
      setEditingPlan(null);
      setTimeline(null);
      setNotice(null);
      setError(null);
    }
  };

  const saveApiKey = async () => {
    if (!apiKeyDraft.trim()) return;

    setSavingKey(true);
    setError(null);

    try {
      const status = await window.videoEditor.saveOpenAiApiKey(apiKeyDraft);
      setAiStatus(status);
      setProviderResults(previous => ({ ...previous, openai: "not_tested" }));
      setApiKeyDraft("");
      setNotice(
        status.persistedSecurely
          ? "AI key saved securely on this computer."
          : "AI key is active for this session."
      );
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setSavingKey(false);
    }
  };

  const checkProvider = async (provider: "openai" | "elevenlabs") => {
    setCheckingProvider(provider);
    try {
      const result = await window.videoEditor.checkProviderConnection(provider);
      setProviderResults(previous => ({ ...previous, [provider]: result.status }));
    } catch {
      setProviderResults(previous => ({ ...previous, [provider]: "network_error" }));
    } finally {
      setCheckingProvider(null);
    }
  };

  const transcribeNarration = async () => {
    if (!narration) return;

    setTranscribing(true);
    setError(null);
    setNotice("Listening to the full narration and creating timestamped speech segments...");

    try {
      const result = await window.videoEditor.transcribeNarration(narration);
      setTranscript(result);
      setEditingPlan(null);
      setTimeline(null);
      setNotice(
        `เสียงบรรยาย analyzed: ${result.segments.length} timestamped speech segments across ${formatTime(result.duration)}.`
      );
    } catch (transcribeError) {
      setError(
        transcribeError instanceof Error
          ? transcribeError.message
          : String(transcribeError)
      );
      setNotice(null);
    } finally {
      setTranscribing(false);
    }
  };

  const buildTimeline = async () => {
    if (!narration || images.length === 0) return;

    setBuilding(true);
    setError(null);
    setNotice(null);

    try {
      const nextTimeline = await window.videoEditor.buildTimeline(
        images,
        narration,
        transcript
      );
      setTimeline(nextTimeline);
      setNotice(
        `Automatic timeline created: ${nextTimeline.clips.length} clips across ${formatTime(nextTimeline.duration)}.`
      );
    } catch (buildError) {
      setError(buildError instanceof Error ? buildError.message : String(buildError));
    } finally {
      setBuilding(false);
    }
  };

  const applyAutomaticSfx = (layers: AudioLayer[]) => {
    setAudioLayers((current) => [
      ...current.filter((layer) => layer.origin !== "auto-sfx"),
      ...layers
    ]);
    setNotice(
      layers.length > 0
        ? `Editing Brain placed ${layers.length} automatic SFX layer${layers.length === 1 ? "" : "s"}.`
        : "Editing Brain found scene cues, but no imported SFX files matched them yet."
    );
  };

  const applyVisualTimeline = (
    nextTimeline: TimelinePlan,
    visualPlan: VisualBrainPlan
  ) => {
    setTimeline(nextTimeline);
    setNotice(
      `Visual Brain created ${visualPlan.shots.length} planned shots from ${visualPlan.descriptors.length} analyzed images.`
    );
    setError(null);
  };

  const exportVideo = async () => {
    if (!timeline) return;

    const renderPlan = { ...timeline, audioLayers };
    const diagnostics = await window.videoEditor.analyzeRenderPlan(renderPlan);
    if (!diagnostics.ready) {
      const blocking = diagnostics.diagnostics
        .filter((item) => item.level === "error")
        .map((item) => item.message)
        .join(" ");
      setError(`Export blocked: ${blocking}`);
      setNotice(null);
      return;
    }

    const missing = await window.videoEditor.checkProjectMedia(projectDocument);
    setMissingMedia(missing);
    if (missing.length > 0) {
      setError(
        `Export blocked: ${missing.length} media file${missing.length === 1 ? "" : "s"} must be relinked first.`
      );
      setNotice(null);
      return;
    }

    const outputPath = await window.videoEditor.chooseOutput();
    if (!outputPath) return;

    setRendering(true);
    setRenderProgress({
      progress: 0,
      elapsed: 0,
      duration: timeline.duration
    });
    setError(null);
    setNotice("กำลังเรนเดอร์ MP4 ด้วย FFmpeg...");

    try {
      const result = await window.videoEditor.renderTimeline(renderPlan, outputPath);
      if (result.testReport) {
        setRenderHistory((current) => [
          result.testReport as FullEpisodeTestReport,
          ...current.filter((item) => item.id !== result.testReport?.id)
        ].slice(0, 20));
      }
      setNotice(
        result.testReport
          ? `Export complete: ${result.outputPath} · Post-render test ${result.testReport.passed ? "passed" : "needs review"}.`
          : `Export complete: ${result.outputPath}`
      );
    } catch (renderError) {
      setError(renderError instanceof Error ? renderError.message : String(renderError));
      setNotice(null);
    } finally {
      setRendering(false);
    }
  };

  const [studioProjects, setStudioProjects] = useState<StudioProject[]>([]);
  const [studioSelectedId, setStudioSelectedId] = useState<string | null>(null);
  const [studioNewTitle, setStudioNewTitle] = useState("");
  const [studioNewEpisode, setStudioNewEpisode] = useState("");
  const [studioBusy, setStudioBusy] = useState(false);
  const [studioEpisodeId, setStudioEpisodeId] = useState<string | null>(null);
  const [studioVoiceFiles, setStudioVoiceFiles] = useState<Record<string, { fingerprint: string; outputPath: string; jobId?: string; speaker?: string; emotion?: string; text?: string }>>({});
  useEffect(() => {
    let active = true;
    setStudioVoiceFiles({});
    if (!studioSelectedId || !studioEpisodeId) return () => { active = false; };
    const refresh = () => { void window.videoEditor.loadStudioEpisodeVoiceAudio(studioSelectedId, studioEpisodeId).then(entries => { if (active) setStudioVoiceFiles(entries); }).catch(() => { if (active) setStudioVoiceFiles({}); }); };
    refresh();
    window.addEventListener("studio-voice-audio-updated", refresh);
    return () => { active = false; window.removeEventListener("studio-voice-audio-updated", refresh); };
  }, [studioSelectedId, studioEpisodeId]);
  const [studioVoiceDurations, setStudioVoiceDurations] = useState<Record<string, number>>({});
  useEffect(() => {
    let active = true;
    setStudioVoiceDurations({});
    if (!studioSelectedId || !studioEpisodeId) return () => { active = false; };
    void Promise.all(Object.entries(studioVoiceFiles).map(async ([lineId, entry]) => {
      try {
        const seconds = await window.videoEditor.getStudioVoiceAudioDuration(studioSelectedId, studioEpisodeId, entry.outputPath);
        return [lineId, seconds] as const;
      } catch {
        return null;
      }
    })).then(results => {
      if (active) setStudioVoiceDurations(Object.fromEntries(results.filter((item): item is readonly [string, number] => item !== null)));
    });
    return () => { active = false; };
  }, [studioSelectedId, studioEpisodeId, studioVoiceFiles]);
  const [studioDialogueGap, setStudioDialogueGap] = useState(0.3);
  const studioVoiceSchedule = scheduleDialogueClips(
    Object.entries(studioVoiceFiles)
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .filter(([lineId]) => Number.isFinite(studioVoiceDurations[lineId]) && studioVoiceDurations[lineId] > 0)
      .map(([lineId, entry]) => ({ lineId, filePath: entry.outputPath, duration: studioVoiceDurations[lineId], jobId: entry.jobId, speaker: entry.speaker, emotion: entry.emotion, text: entry.text })),
    Object.values(studioVoiceFiles).every(entry => Boolean(entry.speaker && entry.text)) ? { sameSpeaker: studioDialogueGap, speakerChange: Math.max(studioDialogueGap, 0.6), sentenceEnd: Math.max(studioDialogueGap, 0.8), narrationChange: Math.max(studioDialogueGap, 1), sceneBreak: Math.max(studioDialogueGap, 1.5) } : studioDialogueGap
  );

  const studioFrameHoldPreview = useMemo(() => {
    if (!timeline?.clips.length || !studioVoiceSchedule.length) return { holds: [], error: null as string | null };
    const anchors = timeline.clips.map((clip, index) => ({
      imageId: clip.id,
      lineId: studioFrameAnchors[clip.id] ?? (index === 0 ? studioVoiceSchedule[0].lineId : "")
    })).filter(anchor => anchor.lineId);
    try {
      return { holds: holdFramesThroughDialogue(studioVoiceSchedule, anchors), error: null as string | null };
    } catch (error) {
      return { holds: [], error: String(error) };
    }
  }, [timeline, studioVoiceSchedule, studioFrameAnchors]);
  const applyStudioFrameHolds = () => {
    if (!timeline || studioFrameHoldPreview.error || studioFrameHoldPreview.holds.length !== timeline.clips.length) {
      setError("กรุณากำหนดบรรทัดเริ่มต้นให้ภาพทุกภาพตามลำดับก่อนนำไปใช้");
      return;
    }
    if (timeline.clips.some(clip => clip.videoPath || !clip.imagePath)) {
      setError("การค้างภาพอัตโนมัติรองรับเฉพาะภาพนิ่ง ยังไม่รองรับคลิปวิดีโอ");
      return;
    }
    const holds = studioFrameHoldPreview.holds;
    if (timeline.subtitles.length > 0 || narration || [...audioLayers, ...timeline.audioLayers].some(layer => layer.origin !== "studio-dialogue") || (timeline.narration && timeline.narration.trim().length > 0)) {
      setError("ไทม์ไลน์นี้มีเสียงบรรยาย คำบรรยาย หรือแทร็กเสียงอื่นที่กำหนดเวลาไว้แล้ว กรุณาปรับจุดเวลาให้ตรงก่อนใช้การค้างภาพอัตโนมัติ");
      return;
    }
    if (holds.some((hold, index) => hold.imageId !== timeline.clips[index].id)) {
      setError("ลำดับภาพไม่ตรงกับลำดับจุดเริ่มภาพ");
      return;
    }
    setTimeline(previous => {
      if (!previous || previous !== timeline) return previous;
      return {
        ...previous,
        duration: holds[holds.length - 1].end,
        transitionDuration: 0,
        clips: previous.clips.map((clip, index) => ({
          ...clip,
          start: holds[index].start,
          duration: holds[index].end - holds[index].start
        }))
      };
    });
    setError(null);
    setNotice("ปรับเวลาแสดงภาพนิ่งตามจุดเริ่มบทพูดแล้ว และปิดภาพซ้อนช่วงเปลี่ยนภาพเพื่อรักษาจุดเริ่มต้น กรุณาตรวจสอบก่อนส่งออกและบันทึกโปรเจกต์");
  };
  const importStudioDialogueToTimeline = async () => {
    if (!studioSelectedId || !studioEpisodeId || !timeline) {
      setError("กรุณาเลือกตอนและสร้างไทม์ไลน์ภาพก่อนนำเข้าเสียงตัวละคร");
      return;
    }
    if (studioVoiceSchedule.length === 0 || studioVoiceSchedule.length !== Object.keys(studioVoiceFiles).length) {
      setError("กรุณารอให้ตรวจสอบความยาว MP3 ครบทุกบรรทัดก่อนนำเข้า");
      return;
    }
    if (timeline.audioLayers.some(layer => layer.origin === "studio-dialogue")) {
      setError("ไทม์ไลน์มีเสียง Studio อยู่ในแทร็กเสียงภายในแล้ว กรุณาตรวจสอบและนำแทร็กซ้ำออกก่อนนำเข้าใหม่ เพื่อป้องกันเสียงพูดซ้อนกัน");
      return;
    }
    const existingStudioLines = audioLayers.filter(layer => layer.origin === "studio-dialogue");
    if (existingStudioLines.length > 0 && existingStudioLines.some(layer => !layer.voiceLineId || !studioVoiceSchedule.some(clip => clip.lineId === layer.voiceLineId))) {
      setError("พบเสียง Studio ที่ไม่ตรงกับบทพูดปัจจุบัน กรุณาตรวจสอบและลบแทร็กเก่าก่อนนำเข้าใหม่ เพื่อป้องกันเสียงที่จัดเวลาไว้สูญหาย");
      return;
    }
    if (existingStudioLines.length > 0 && (
      existingStudioLines.length !== studioVoiceSchedule.length ||
      existingStudioLines.some(layer => {
        const current = studioVoiceSchedule.find(clip => clip.lineId === layer.voiceLineId);
        return !current || Math.abs(layer.start - current.start) > 0.05 || Math.abs(layer.duration - current.duration) > 0.05;
      })
    )) {
      setError("เวลาหรือจำนวนบรรทัดเสียง Studio เปลี่ยนจากที่วางไว้บนไทม์ไลน์ กรุณาตรวจสอบแทร็กเดิมก่อนนำเข้าใหม่ เพื่อไม่ให้ตำแหน่งเสียงที่แก้ไขไว้ถูกแทนที่");
      return;
    }
    if (existingStudioLines.length > 0 && existingStudioLines.some(layer => {
      const current = studioVoiceSchedule.find(clip => clip.lineId === layer.voiceLineId);
      return !current || (layer.voiceJobId && current.jobId && layer.voiceJobId !== current.jobId) ||
        (layer.voiceText && current.text && layer.voiceText !== current.text) ||
        (layer.voiceSpeaker && current.speaker && layer.voiceSpeaker !== current.speaker);
    })) {
      setError("เสียง Studio ชุดใหม่มีข้อความ ผู้พูด หรือรหัสงานเสียงต่างจากที่นำเข้าไว้ กรุณาตรวจสอบก่อนแทนที่ เพื่อป้องกันการสูญเสียเสียงฉบับที่เลือกไว้");
      return;
    }
    const voiceEnd = studioVoiceSchedule[studioVoiceSchedule.length - 1].end;
    if (voiceEnd > timeline.duration + 0.001) {
      const lastClip = timeline.clips[timeline.clips.length - 1];
      if (!lastClip || !lastClip.imagePath || lastClip.videoPath || !Number.isFinite(lastClip.start) || !Number.isFinite(lastClip.duration) || lastClip.duration <= 0 || Math.abs(lastClip.start + lastClip.duration - timeline.duration) > 0.05) {
        setError("เสียงยาวกว่าไทม์ไลน์และไม่สามารถยืดภาพท้ายได้อัตโนมัติ กรุณาปรับภาพหรือระยะเวลาเอง");
        return;
      }
    }
    try {
      const imported = await Promise.all(studioVoiceSchedule.map(async clip => ({
        id: "studio-dialogue:" + studioSelectedId + ":" + studioEpisodeId + ":" + clip.lineId,
        filePath: await window.videoEditor.resolveStudioVoiceAudio(studioSelectedId, studioEpisodeId, clip.filePath),
        kind: "dialogue" as const,
        start: clip.start,
        duration: clip.duration,
        volume: 1,
        loop: false,
        fadeIn: 0,
        fadeOut: 0,
        origin: "studio-dialogue" as const,
        label: clip.lineId,
        voiceLineId: clip.lineId,
        ...(clip.jobId ? { voiceJobId: clip.jobId } : {}),
        ...(clip.speaker ? { voiceSpeaker: clip.speaker } : {}),
        ...(clip.emotion ? { voiceEmotion: clip.emotion } : {}),
        ...(clip.text ? { voiceText: clip.text } : {})
      })));
      if (voiceEnd > timeline.duration + 0.001) {
        setTimeline(previous => {
          if (!previous || previous !== timeline) return previous;
          const clips = [...previous.clips];
          const last = clips[clips.length - 1];
          if (!last || !last.imagePath || last.videoPath || !Number.isFinite(last.start) || !Number.isFinite(last.duration) || last.duration <= 0 || Math.abs(last.start + last.duration - previous.duration) > 0.05) return previous;
          clips[clips.length - 1] = { ...last, duration: voiceEnd - last.start };
          return { ...previous, duration: voiceEnd, clips };
        });
      }
      setAudioLayers(previous => [...previous.filter(layer => layer.origin !== "studio-dialogue"), ...imported]);
      setError(null);
      setNotice("นำเข้าเสียงตัวละคร " + imported.length + " บรรทัดเป็นแทร็กสำหรับเรนเดอร์แล้ว กรุณาบันทึกโปรเจกต์");
    } catch (error) {
      setError("นำเข้าเสียงตัวละครไม่สำเร็จ: " + String(error));
    }
  };
  const [studioScript, setStudioScript] = useState("");
  const [studioSavedScript, setStudioSavedScript] = useState("");
  const [studioScriptBusy, setStudioScriptBusy] = useState(false);
  const studioScriptDirty = studioScript !== studioSavedScript;
  useEffect(() => {
    if (!studioScriptDirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [studioScriptDirty]);
  const openStudioEpisode = async (episodeId: string) => {
    if (!studioSelectedId || studioScriptBusy) return;
    if (studioScriptDirty && !window.confirm("บทที่แก้ไขยังไม่ได้บันทึก ต้องการทิ้งการแก้ไขหรือไม่?")) return;
    setStudioScriptBusy(true);
    try {
      const loaded = await window.videoEditor.loadStudioEpisodeScript(studioSelectedId, episodeId);
      setStudioEpisodeId(episodeId);
      setStudioScript(loaded);
      setStudioSavedScript(loaded);
    } catch (error) { setError(String(error)); }
    finally { setStudioScriptBusy(false); }
  };
  const saveStudioScript = async () => {
    if (!studioSelectedId || !studioEpisodeId || studioScriptBusy) return;
    setStudioScriptBusy(true);
    try {
      await window.videoEditor.saveStudioEpisodeScript(studioSelectedId, studioEpisodeId, studioScript);
      setStudioSavedScript(studioScript);
      setNotice("บันทึกบท EP เรียบร้อยแล้ว");
    } catch (error) { setError(String(error)); }
    finally { setStudioScriptBusy(false); }
  };
  const closeStudioEpisode = () => {
    if (studioScriptDirty && !window.confirm("บทที่แก้ไขยังไม่ได้บันทึก ต้องการปิดโดยไม่บันทึกหรือไม่?")) return;
    setStudioEpisodeId(null);
    setStudioScript("");
    setStudioSavedScript("");
  };
  const leaveStudioProject = () => {
    if (studioScriptDirty && !window.confirm("บทที่แก้ไขยังไม่ได้บันทึก ต้องการออกจากโปรเจกต์หรือไม่?")) return;
    setStudioEpisodeId(null);
    setStudioScript("");
    setStudioSavedScript("");
    setStudioSelectedId(null);
  };
  const refreshStudioProjects = async () => {
    setStudioProjects(await window.videoEditor.listStudioProjects());
  };
  useEffect(() => { void refreshStudioProjects().catch(e => setError(String(e))); }, []);
  const addStudioProject = async () => {
    if (!studioNewTitle.trim() || studioBusy || studioScriptBusy) return;
    if (studioScriptDirty && !window.confirm("บท EP ปัจจุบันยังไม่ได้บันทึก ต้องการสร้างโปรเจกต์ใหม่และทิ้งการแก้ไขหรือไม่?")) return;
    setStudioBusy(true);
    try {
      const created = await window.videoEditor.createStudioProject(studioNewTitle);
      setStudioNewTitle("");
      await refreshStudioProjects();
      setStudioEpisodeId(null);
      setStudioScript("");
      setStudioSavedScript("");
      setStudioSelectedId(created.id);
    } catch(e) { setError(String(e)); }
    finally { setStudioBusy(false); }
  };
  const addStudioEpisode = async () => {
    if (!studioSelectedId || !studioNewEpisode.trim() || studioBusy) return;
    setStudioBusy(true);
    try {
      const created = await window.videoEditor.createStudioEpisode(studioSelectedId, studioNewEpisode);
      setStudioNewEpisode("");
      await refreshStudioProjects();
      await openStudioEpisode(created.id);
      setActiveProductionTab("dashboard");
      setNotice("เพิ่มตอนใหม่แล้ว · เปิดบท EP ด้านล่างเพื่อเขียนบท หรือเลือกสร้างเสียงตอนนี้");
    } catch(e) { setError(String(e)); }
    finally { setStudioBusy(false); }
  };
  const openEpisodeEditor = async (episodeId: string) => {
    if (!studioSelectedId || studioBusy || studioScriptBusy) return;
    if (hasProjectContent && !episodeEditorRef.current && !window.confirm("ไทม์ไลน์เดิมยังไม่ได้เชื่อมกับ EP กรุณาบันทึกไฟล์ .aivproj ก่อนเปลี่ยนตอน ต้องการดำเนินการต่อหรือไม่?")) return;
    if (studioScriptDirty && !window.confirm("บท EP ที่แก้ไขยังไม่ได้บันทึก ต้องการเปลี่ยนตอนหรือไม่?")) return;
    setStudioBusy(true);
    try {
      const previous = episodeEditorRef.current;
      // Invalidate delayed autosave callbacks before awaiting disk writes.
      // A callback from the outgoing EP must not race with the incoming load.
      ++autosaveGenerationRef.current;
      if (previous) {
        if (projectDocument.id !== "episode-" + previous.episodeId) {
          throw new Error("ข้อมูลไทม์ไลน์ไม่ตรงกับ EP เดิม ยกเลิกการสลับตอนเพื่อป้องกันการบันทึกผิด EP");
        }
        // Reopening the same EP must also flush edits before reading from disk;
        // otherwise a pending debounce could make the screen revert to old data.
        await queueEpisodeSave(previous.projectId, previous.episodeId, projectDocument);
      }
      const stored = await window.videoEditor.loadStudioEpisodeEditor(studioSelectedId, episodeId);
      // Complete all fallible reads before mutating the active editor state.
      const episodeScript = await window.videoEditor.loadStudioEpisodeScript(studioSelectedId, episodeId);
      if (stored) {
        // Older episode files may use a different document id; normalize it
        // when restoring so the autosave scope guard remains reliable.
        applyLoadedProject({ project: { ...stored, id: "episode-" + episodeId }, filePath: null, missingMedia: [] });
      } else {
        setProjectId("episode-" + episodeId);
        setProjectTitle((selectedStudioProject?.title ?? "โปรเจกต์") + " · " + (selectedStudioProject?.episodes.find(ep => ep.id === episodeId)?.title ?? "EP"));
        setProjectCreatedAt(new Date().toISOString());
        setProjectPath(null);
        setImages([]);
        setเสียงบรรยาย(null);
        setTranscript(null);
        setEditingPlan(null);
        setTimeline(null);
        setAudioLayers([]);
        setStudioFrameAnchors({});
        setContentProject(null);
        setRenderHistory([]);
        setMissingMedia([]);
      }
      // The editor switch already confirmed unsaved-script changes above.
      // Load the target script directly: openStudioEpisode may silently return
      // while busy or prompt again, leaving a mismatched script/editor pair.
      setStudioEpisodeId(episodeId);
      setStudioScript(episodeScript);
      setStudioSavedScript(episodeScript);
      episodeEditorRef.current = { projectId: studioSelectedId, episodeId };
      setEpisodeEditorScope({ projectId: studioSelectedId, episodeId });
      setActiveProductionTab("editor");
      setNotice("เปิดไทม์ไลน์เฉพาะ EP แล้ว · ใช้ปุ่มบันทึกไทม์ไลน์ EP เพื่อเก็บงานของตอนนี้");
    } catch (error) { setError(String(error)); }
    finally { setStudioBusy(false); }
  };
  const saveEpisodeEditor = async () => {
    const target = episodeEditorRef.current;
    if (!target || studioBusy) return;
    if (projectDocument.id !== "episode-" + target.episodeId) {
      setError("ไทม์ไลน์ยังไม่ตรงกับ EP ที่เปิดอยู่ กรุณาเปิด EP ใหม่จากรายการตอนก่อนบันทึก");
      return;
    }
    setStudioBusy(true);
    try {
      await queueEpisodeSave(target.projectId, target.episodeId, projectDocument);
      setNotice("บันทึกไทม์ไลน์ของ EP เรียบร้อยแล้ว");
    } catch (error) { setError(String(error)); }
    finally { setStudioBusy(false); }
  };
  const selectedStudioProject = studioProjects.find(p => p.id === studioSelectedId);
  const browserMode=document.documentElement.dataset.runtime==="browser";

  const [activeProductionTab, setActiveProductionTab] = useState<"dashboard" | "settings" | "accounts" | "voices" | "script" | "editor">("dashboard");
  const navigateStudioTab = (tab: typeof activeProductionTab) => {
    if (tab !== activeProductionTab && studioScriptDirty && !window.confirm("บทที่แก้ไขยังไม่ได้บันทึก ต้องการเปลี่ยนเมนูโดยไม่บันทึกหรือไม่?")) return;
    setActiveProductionTab(tab);
  };
  const [theme, setTheme] = useState(() => localStorage.getItem("studio-theme-v1") || "indigo");
  const [fontStyle, setFontStyle] = useState(() => localStorage.getItem("studio-font-v1") || "modern");
  const paletteOptions = [
    { id: "default", name: "ค่าเริ่มต้น", background: "#101827", card: "#233047" },
    { id: "ocean", name: "น้ำเงิน", background: "#101d3b", card: "#234a78" },
    { id: "purple", name: "ม่วง", background: "#20162f", card: "#483568" },
    { id: "forest", name: "เขียว", background: "#10261f", card: "#285342" },
    { id: "cream", name: "ครีม", background: "#f4eee3", card: "#ffffff" },
    { id: "rose", name: "ชมพู", background: "#301e2a", card: "#694257" }
  ] as const;
  type PaletteId = (typeof paletteOptions)[number]["id"];
  const readPalette = (key: string): PaletteId => {
    const saved = localStorage.getItem(key);
    return paletteOptions.some(option => option.id === saved) ? saved as PaletteId : "default";
  };
  const [backgroundPalette, setBackgroundPalette] = useState<PaletteId>(() => readPalette("studio-background-v1"));
  const [cardPalette, setCardPalette] = useState<PaletteId>(() => readPalette("studio-cards-v1"));
  useEffect(() => {
    localStorage.setItem("studio-background-v1", backgroundPalette);
    localStorage.setItem("studio-cards-v1", cardPalette);
  }, [backgroundPalette, cardPalette]);
  const backgroundColor = paletteOptions.find(option => option.id === backgroundPalette)!.background;
  const cardColor = paletteOptions.find(option => option.id === cardPalette)!.card;
  const cardTextColor = cardPalette === "cream" ? "#192337" : "#f4f7ff";

  useEffect(() => { localStorage.setItem("studio-theme-v1", theme); localStorage.setItem("studio-font-v1", fontStyle); }, [theme, fontStyle]);

  return (
    <>
      {browserMode && <div className="browserModeBanner"><strong>🌐 Browser Mode</strong><span>เปิดใช้งานจากเว็บได้แล้ว · งาน Render / AI / Publish จะย้ายไปทำผ่าน Backend Worker</span></div>}
      <div className={`studioLayout studioTheme-${theme} studioFont-${fontStyle} ${cardPalette === "cream" ? "studioLightCards" : ""}`} style={{ "--studio-user-background": backgroundColor, "--studio-user-card": cardColor, "--studio-user-card-text": cardTextColor } as React.CSSProperties}>
      <aside className="studioSidebar" aria-label="เมนูหลัก">
        <div className="studioBrand"><span className="studioBrandIcon">♫</span><div><strong>AI VOICE STUDIO</strong><small>สร้างเสียงพากย์ด้วย ElevenLabs</small></div></div>
        <div className="studioSideLinks">
          <button className={activeProductionTab === "dashboard" ? "selected" : ""} onClick={() => navigateStudioTab("dashboard")}>▦ โปรเจกต์ของฉัน</button>
          <button className={activeProductionTab === "accounts" ? "selected" : ""} onClick={() => navigateStudioTab("accounts")}>♫ คลังเสียงตัวละคร</button>
          <button className={activeProductionTab === "script" ? "selected" : ""} onClick={() => navigateStudioTab("script")}>♬ สร้างเสียงพากย์ · บท</button>
          <button className={activeProductionTab === "editor" ? "selected" : ""} onClick={() => navigateStudioTab("editor")}>▣ ตัดต่อ · ส่งออก</button>
        </div>
        <div style={{marginTop:"auto"}} className="studioSideLinks">
          <button className={activeProductionTab === "settings" ? "selected" : ""} onClick={() => navigateStudioTab("settings")}>⚙ ตั้งค่า</button>
        </div>
            </aside>
      <main className="shell editorWorkspace studioMain">
      <header className="topbar">
        <div>
          <p className="eyebrow">AI VOICE STUDIO · PRODUCTION WORKSPACE</p>
          <h1>{activeProductionTab === "dashboard" ? "โปรเจกต์ของฉัน" : activeProductionTab === "settings" ? "ตั้งค่า" : activeProductionTab === "accounts" ? "คลังเสียงตัวละคร" : activeProductionTab === "voices" ? "คลังเสียงตัวละคร" : activeProductionTab === "script" ? "สร้างเสียงพากย์จากบท" : "AI Video Editor"}</h1>
        </div>
        <div className="status">
          <span className="statusDot" />
          ระยะที่ 1 · ระบบตัดต่อและเล่นวิดีโอในแอป
        </div>
      </header>



      {activeProductionTab === "dashboard" && <section className="compactTabContent studioProjectDashboard">
        <h2>{selectedStudioProject ? selectedStudioProject.title : "โปรเจกต์ของฉัน"}</h2>
        {selectedStudioProject ? <>
          <button onClick={leaveStudioProject}>← กลับไปโปรเจกต์ทั้งหมด</button>
          <h3>คลังเสียงตัวละคร</h3>
          <p>คลังตัวละครของเรื่องนี้: {selectedStudioProject.folder}/characters</p>
          <p>โปรเจกต์เรื่องและตอน (EP) อยู่ใน AI Voice Studio · ปุ่ม “เปิดโปรเจกต์” ของหน้าตัดต่อใช้เปิดไฟล์ .aivproj คนละประเภท ไม่ใช่การเปิดตอน</p>
          <h3>ตอนทั้งหมด (EP)</h3>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><input aria-label="ชื่อตอนใหม่" placeholder="พิมพ์ชื่อตอน เช่น EP02" value={studioNewEpisode} onChange={e=>setStudioNewEpisode(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void addStudioEpisode(); } }} /><button type="button" disabled={studioBusy || studioScriptBusy || !studioNewEpisode.trim()} onClick={() => void addStudioEpisode()}>+ เพิ่ม EP</button></div><p>พิมพ์ชื่อตอนก่อนกดเพิ่ม EP · ระบบจะเปิดบทตอนใหม่ให้ทันที</p>
          {selectedStudioProject.episodes.map(ep => <div key={ep.id} className="studioProjectRow"><strong>{ep.title}</strong><small>{ep.folder}</small><button type="button" disabled={studioScriptBusy} onClick={() => void openStudioEpisode(ep.id)}>{studioEpisodeId === ep.id ? "เปิดอยู่" : "เปิดบท EP"}</button><button type="button" disabled={studioScriptBusy} onClick={() => { void openStudioEpisode(ep.id).then(() => setActiveProductionTab("script")); }}>สร้างเสียงตอนนี้ →</button><button type="button" disabled={studioBusy || studioScriptBusy} onClick={() => { void openEpisodeEditor(ep.id); }}>🎬 เปิดไทม์ไลน์ EP</button></div>)}
          {studioEpisodeId && <section aria-label="แก้ไขบท EP">
            <h3>บทละคร: {selectedStudioProject.episodes.find(ep => ep.id === studioEpisodeId)?.title}</h3>
            <p>{studioScriptDirty ? "● มีการแก้ไขที่ยังไม่ได้บันทึก" : "บันทึกแล้ว"}</p>
            <textarea aria-label="เนื้อหาบทละคร" rows={18} style={{width:"100%",boxSizing:"border-box"}} value={studioScript} onChange={e => setStudioScript(e.target.value)} disabled={studioScriptBusy} />
            <div style={{display:"flex",gap:8}}>
              <button type="button" disabled={studioScriptBusy || !studioScriptDirty} onClick={() => void saveStudioScript()}>บันทึกบท EP</button>
              <button type="button" disabled={studioScriptBusy} onClick={closeStudioEpisode}>ปิดบท</button>
            </div>
          </section>}
        </> : <>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><input placeholder="ชื่อเรื่องใหม่" value={studioNewTitle} onChange={e=>setStudioNewTitle(e.target.value)} /><button disabled={studioBusy || !studioNewTitle.trim()} onClick={addStudioProject}>+ เพิ่มโปรเจกต์</button></div>
          {studioProjects.length === 0 && <p>ยังไม่มีโปรเจกต์ในระบบใหม่ · งานเก่าของคุณยังอยู่ในระบบเดิม</p>}
          {studioProjects.map(p => <button key={p.id} className="studioProjectRow" onClick={() => setStudioSelectedId(p.id)}><strong>{p.title}</strong><small>{p.episodes.length} EP · เปิดโปรเจกต์ →</small></button>)}
        </>}
      </section>}
      {activeProductionTab === "settings" && <section className="compactTabContent">
        <h2>ตั้งค่า</h2>
        <ElevenLabsSettingsPanel />
        <div className="studioPaletteEditor">
          <h3>🎨 สีพื้นหลังและสีการ์ด</h3>
          <p>เลือกสีแยกกันได้ ระบบจะจำค่าบนเครื่องนี้และใช้กับทุกโปรเจกต์</p>
          <div className="studioPaletteSections">
            {([
              { title: "พื้นหลังแอป", value: backgroundPalette, change: setBackgroundPalette },
              { title: "พื้นหลังการ์ด", value: cardPalette, change: setCardPalette }
            ] as const).map(section => (
              <fieldset key={section.title} className="studioPaletteFieldset">
                <legend>{section.title}</legend>
                <div className="studioPaletteChoices">
                  {paletteOptions.map(option => (
                    <button type="button" key={option.id} className={`studioPaletteChoice ${section.value === option.id ? "active" : ""}`}
                      aria-pressed={section.value === option.id} onClick={() => section.change(option.id)}>
                      <span className="studioPaletteSample" style={{ background: section.title === "พื้นหลังแอป" ? option.background : option.card }} />
                      <span>{option.name}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
          <button type="button" onClick={() => { setBackgroundPalette("default"); setCardPalette("default"); }}>คืนค่าสีเริ่มต้น</button>
        </div>

        <div className="studioThemeControls"><strong>🎨 ธีมแอป</strong><div className="studioThemeSwatches">{(["indigo","ocean","emerald","rose","amber","slate"] as const).map(color => <button key={color} type="button" className={`studioSwatch ${theme === color ? "chosen" : ""}`} data-color={color} aria-label={`เลือกธีม ${color}`} title={color} onClick={() => setTheme(color)} />)}</div><label>รูปแบบตัวอักษร<select value={fontStyle} onChange={event => setFontStyle(event.target.value)}><option value="modern">Modern</option><option value="rounded">Rounded</option><option value="classic">Elegant</option></select></label></div>
      </section>}
      {activeProductionTab === "editor" && episodeEditorScope && <p>🎬 โหมดไทม์ไลน์ EP: เปิดและบันทึกจากรายการตอนใน AI Voice Studio โดยตรง ไม่ใช้ไฟล์ .aivproj ส่วนกลาง</p>}
      {activeProductionTab === "editor" && studioSelectedId && studioEpisodeId && <button type="button" disabled={studioBusy} onClick={() => { void saveEpisodeEditor(); }}>💾 บันทึกไทม์ไลน์ EP</button>}
      {activeProductionTab === "editor" && !episodeEditorScope && <ProjectToolbar
        title={projectTitle}
        projectPath={projectPath}
        autosaveState={autosaveState}
        onTitleChange={setProjectTitle}
        onOpen={openProjectFile}
        onSave={saveProjectFile}
      />}

      <div className="compactTabContent" hidden={activeProductionTab !== "accounts" && activeProductionTab !== "voices"}><CharacterVoiceLibrary projectId={studioSelectedId} /></div>


      <section className="compactTabContent" hidden={activeProductionTab !== "script"} aria-label="ขั้นตอนที่ 1 ใส่บท แยกบท และเตรียมเสียง">
        <VoiceStudioPanel projectId={studioSelectedId} episodeId={studioEpisodeId} />
      </section>

      <section className="compactTabContent" hidden={activeProductionTab !== "editor"} aria-label="ขั้นตอนที่ 2 ถึง 7 ผลิตและส่งออกวิดีโอ">
      <div className="aiSfxToggleBar">
        <div><strong>🎧 AI เสียงเอฟเฟกต์ (SFX)</strong><p>{aiSfxEnabled ? "เปิดไว้สำหรับการวิเคราะห์ SFX เมื่อระบบพร้อมใช้งาน · ไม่มีการใช้เครดิตอัตโนมัติ" : "ปิดอยู่ · ไม่ต้องวิเคราะห์หรือค้นหา SFX ด้วย AI · เสียงที่เพิ่มเองยังใช้งานได้"}</p></div>
        <label className="aiSfxToggleControl"><input type="checkbox" checked={aiSfxEnabled} onChange={(event) => setAiSfxEnabled(event.target.checked)} /><span>{aiSfxEnabled ? "เปิด" : "ปิด"}</span></label>
      </div>
      <MediaRelinkPanel
        missingMedia={missingMedia}
        relinking={relinking}
        onRelinkFolder={relinkFromFolder}
        onRelinkSingle={relinkSingle}
      />

      <details className="hero compactIntro">
        <div>
          <p className="kicker">ตัดต่อเรื่องราวอัตโนมัติ</p>
          <h2>ให้ AI ฟัง ดู วางช็อต และจัดเสียงให้คุณ</h2>
          <p className="lede">
            Long narration becomes a timestamped story map, grouped scenes, matched visuals, deliberate shot timing, and layered sound before the final cut is rendered.
          </p>
        </div>
        <div className="heroBadge">🎧</div>
      </details>

      <section className="studioTimelineDock" aria-label="ไทม์ไลน์ตัดต่อ">
  <div className="studioTimelineTitle"><strong>🎬 ไทม์ไลน์ตัดต่อ</strong><span>{timeline ? `${timeline.clips.length} คลิป · ${formatTime(timeline.duration)}` : "ยังไม่มีคลิปในไทม์ไลน์"}</span></div>
  <div className="studioTimelineRuler"><span>00:00</span><span>{timeline ? formatTime(timeline.duration / 4) : "00:15"}</span><span>{timeline ? formatTime(timeline.duration / 2) : "00:30"}</span><span>{timeline ? formatTime(timeline.duration * .75) : "00:45"}</span><span>{timeline ? formatTime(timeline.duration) : "01:00"}</span></div>
  <div className="studioTimelineTrack"><strong>▧ ภาพ</strong><div className="studioTimelineLane">{timeline?.clips.length ? timeline.clips.map((clip, index) => <span key={clip.id} className="studioTimelineClip" style={{ flexGrow: Math.max(.6, clip.duration) }} title={`${fileName(clip.imagePath)} · ${clip.duration.toFixed(1)} วินาที`}>{index + 1}. {fileName(clip.imagePath)}</span>) : <em>เพิ่มภาพและสร้างไทม์ไลน์เพื่อเริ่มตัดต่อ</em>}</div></div>
  {timeline?.clips.length && studioVoiceSchedule.length ? <div className="studioVoiceInventory"><strong>🖼 จุดเริ่มภาพตามบรรทัดเสียง (ตัวอย่างก่อนนำไปใช้)</strong><p>กำหนดภาพแต่ละภาพให้เริ่มที่บรรทัดเสียงใด ภาพก่อนหน้าจะค้างไว้จนถึงจุดเริ่มภาพใหม่ ระบบยังไม่เปลี่ยนไทม์ไลน์จริง</p>{timeline.clips.map((clip, index) => <label key={clip.id}>{index + 1}. {fileName(clip.imagePath)} <select value={studioFrameAnchors[clip.id] ?? (index === 0 ? studioVoiceSchedule[0].lineId : "")} onChange={event => setStudioFrameAnchors(previous => ({ ...previous, [clip.id]: event.target.value }))}><option value="">ไม่กำหนดจุดเริ่มภาพ</option>{studioVoiceSchedule.map(line => <option key={line.lineId} value={line.lineId}>{line.lineId} · {formatTime(line.start)}</option>)}</select></label>)}{studioFrameHoldPreview.error ? <p role="alert">{studioFrameHoldPreview.error}</p> : <ol>{studioFrameHoldPreview.holds.map(hold => <li key={hold.imageId}>{fileName(timeline.clips.find(clip => clip.id === hold.imageId)?.imagePath ?? hold.imageId)}: {formatTime(hold.start)}–{formatTime(hold.end)}</li>)}</ol>}<button type="button" onClick={applyStudioFrameHolds} disabled={Boolean(studioFrameHoldPreview.error) || studioFrameHoldPreview.holds.length !== timeline.clips.length || Boolean(narration) || timeline.subtitles.length > 0 || [...audioLayers, ...timeline.audioLayers].some(layer => layer.origin !== "studio-dialogue") || timeline.clips.some(clip => Boolean(clip.videoPath))}>ใช้ระยะเวลาภาพตามบทพูด</button></div> : null}
  <div className="studioTimelineTrack"><strong>♫ เสียงพากย์</strong><div className="studioTimelineLane">{narration ? <span className="studioTimelineAudio">{fileName(narration)}</span> : <em>ยังไม่ได้เลือกไฟล์เสียงพากย์</em>}</div></div>
  <div className="studioTimelineTrack"><strong>🎙 เสียงตัวละคร</strong><div className="studioTimelineLane">{Object.keys(studioVoiceFiles).length ? <div className="studioVoiceInventory"><strong>MP3 ที่ตรวจสอบแล้ว {Object.keys(studioVoiceFiles).length} บรรทัด</strong><ol>{Object.entries(studioVoiceFiles).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })).map(([lineId, entry]) => <li key={lineId} title={entry.outputPath}><span>{lineId}</span> · <span>{fileName(entry.outputPath)}</span> · <span>{(() => { const slot = studioVoiceSchedule.find(item => item.lineId === lineId); return slot ? `${slot.start.toFixed(2)}–${slot.end.toFixed(2)} วินาที` : "กำลังอ่านระยะเวลา"; })()}</span></li>)}</ol><label>ระยะพักระหว่างเสียง (วินาที) <input type="number" min="0" max="5" step="0.1" value={studioDialogueGap} onChange={event => { const next = Number(event.target.value); if (Number.isFinite(next)) setStudioDialogueGap(Math.max(0, Math.min(5, next))); }} /></label><small>ใช้จังหวะตามผู้พูดและจบประโยคเมื่อ MP3 มีข้อมูลบทครบทุกบรรทัด มิฉะนั้นใช้ระยะพักคงที่เพื่อไม่เดาผู้พูด</small><button type="button" onClick={() => { void importStudioDialogueToTimeline(); }} disabled={!timeline || studioVoiceSchedule.length !== Object.keys(studioVoiceFiles).length}>นำเสียงตัวละครเข้าไทม์ไลน์</button></div> : <em>ยังไม่มี MP3 ของตัวละครในตอนนี้</em>}</div></div>
  <div className="studioTimelineTrack"><strong>▤ คำบรรยาย</strong><div className="studioTimelineLane">{timeline?.subtitles.length ? timeline.subtitles.map((cue, index) => <span key={cue.id} className="studioTimelineSubtitle" title={cue.text}>{index + 1}</span>) : <em>ยังไม่มีคำบรรยาย</em>}</div></div>
  <p className="studioTimelineHint">นี่คือภาพรวมไทม์ไลน์ · เมื่อสร้างไทม์ไลน์แล้ว ใช้แผงแก้ไขช็อตด้านล่างเพื่อลากสลับคลิปและปรับจุดตัด</p>
</section>
<div className="editorThreePane">
        <div className="editorMediaPane">
          <section id="editor-media" className="grid">
        <article className="panel">
          <div className="panelHeader">
            <div>
              <span className="step">01</span>
              <h3>ภาพประกอบเรื่อง</h3>
            </div>
            <button onClick={chooseImages}>เลือกภาพ</button>
          </div>
          <p className="muted">{summary}</p>
          <div className="mediaList">
            {images.slice(0, 8).map((image, index) => (
              <div className="mediaRow" key={image}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{fileName(image)}</strong>
              </div>
            ))}
            {images.length > 8 && (
              <div className="mediaRow more">+ {images.length - 8} more</div>
            )}
          </div>
        </article>

        <article className="panel">
          <div className="panelHeader">
            <div>
              <span className="step">02</span>
              <h3>เสียงบรรยาย</h3>
            </div>
            <button onClick={chooseเสียงบรรยาย}>เลือกเสียง</button>
          </div>
          <p className="muted">
            {narration ? fileName(narration) : "ยังไม่ได้เลือกเสียงบรรยาย"}
          </p>
          <div className="audioCard">
            <div className="wave">▂▅▇▃▆▂▇▅▃▆▇▂▅▃▇▆▂▅</div>
            <span>
              {transcript
                ? `${transcript.segments.length} timestamped segments ready`
                : narration
                  ? "พร้อมให้ AI วิเคราะห์เสียง"
                  : "รอไฟล์เสียง"}
            </span>
          </div>
        </article>
          </section>

</div>
      <section id="editor-preview" className="editorPreviewPane" aria-label="หน้าต่างพรีวิว">
        <div className="editorPaneHeading"><strong>พรีวิววิดีโอ</strong><span>{timeline ? `${timeline.width}×${timeline.height} · ${timeline.fps} fps` : "รอสร้างไทม์ไลน์"}</span></div>
        {timeline ? (
          <QuickPreviewPanel
            plan={{ ...timeline, audioLayers }}
            disabled={
              rendering ||
              building ||
              transcribing ||
              missingMedia.length > 0
            }
          />
        ) : (
          <div className="editorEmptyPreview"><span className="editorPlayGlyph">▶</span><strong>พร้อมเริ่มตัดต่อ</strong><p>นำเข้าภาพและเสียง แล้วให้ AI สร้างไทม์ไลน์เพื่อดูตัวอย่าง</p></div>
        )}
      </section>

        <div className="editorInspectorPane">      <section id="editor-ai" className="aiPanel">
        <div className="aiPanelHeader">
          <div>
            <p className="eyebrow">ระบบวิเคราะห์เสียง AI</p>
            <h3>ฟังเสียงทั้งตอนและรักษาเวลาอย่างแม่นยำ</h3>
            <p className="muted">
              The audio is processed in 10-minute chunks, then every speech segment is restored to its original episode timestamp.
            </p>
          </div>
          <span className={aiStatus.configured ? "aiBadge readyBadge" : "aiBadge"}>
            {aiStatus.configured ? "เชื่อมต่อ AI แล้ว" : "ต้องตั้งค่า API key"}
          </span>
        </div>

        <div className="keyRow">
          <button disabled={checkingProvider !== null} onClick={() => void checkProvider("openai")}>ทดสอบ OpenAI</button>
          <span role="status">{providerStatusLabel[providerResults.openai] ?? "ยังไม่ได้ทดสอบ"}</span>
          <button disabled={checkingProvider !== null} onClick={() => void checkProvider("elevenlabs")}>ทดสอบ ElevenLabs</button>
          <span role="status">{providerStatusLabel[providerResults.elevenlabs] ?? "ยังไม่ได้ทดสอบ"}</span>
        </div>

        {!aiStatus.configured && (
          <div className="keyRow">
            <input
              type="password"
              value={apiKeyDraft}
              onChange={(event) => setApiKeyDraft(event.target.value)}
              placeholder="OpenAI API key"
              autoComplete="off"
            />
            <button disabled={!apiKeyDraft.trim() || savingKey} onClick={saveApiKey}>
              {savingKey ? "กำลังบันทึก..." : "บันทึกคีย์"}
            </button>
          </div>
        )}

        {aiStatus.configured && (
          <div className="aiControls">
            <div>
              <strong>ถอดเสียงพร้อมเวลา</strong>
              <small>
                {aiStatus.persistedSecurely
                  ? "Key is stored using operating-system encryption."
                  : "Key is available for this session or environment."}
              </small>
            </div>
            <button
              className="primary"
              disabled={!narration || transcribing || rendering || building}
              onClick={transcribeNarration}
            >
              {transcribing ? "กำลังฟังเสียงบรรยาย..." : transcript ? "วิเคราะห์อีกครั้ง" : "วิเคราะห์เสียงบรรยาย"}
            </button>
          </div>
        )}
      </section>
</div>
      </div>

      {(notice || error) && (
        <section className={error ? "message errorMessage" : "message"}>
          {error ?? notice}
        </section>
      )}

      {transcript && (
        <section className="transcriptPanel">
          <div className="timelineHeader">
            <div>
              <p className="eyebrow">แผนเรื่อง</p>
              <h3>เสียงบรรยายพร้อมเวลา</h3>
            </div>
            <div className="timelineMeta">
              <span>{transcript.language ?? "auto language"}</span>
              <span>{transcript.segments.length} segments</span>
              <span>{formatTime(transcript.duration)}</span>
            </div>
          </div>

          <div className="transcriptList">
            {transcript.segments.slice(0, 24).map((segment) => (
              <div className="transcriptRow" key={segment.id}>
                <span>
                  {formatTime(segment.start)} → {formatTime(segment.end)}
                </span>
                <p>{segment.text}</p>
              </div>
            ))}
          </div>

          {transcript.segments.length > 24 && (
            <p className="timelineHint">
              Showing the first 24 segments. The complete transcript remains available to the editing engine.
            </p>
          )}
        </section>
      )}

      <EditingBrainPanel
        transcript={transcript}
        onApplyAutoLayers={applyAutomaticSfx}
        onPlanChange={setEditingPlan}
      />

      <VisualBrainPanel
        images={images}
        narration={narration}
        editingPlan={editingPlan}
        transcript={transcript}
        onTimelineReady={applyVisualTimeline}
      />

      <AudioLayersPanel layers={audioLayers} onChange={setAudioLayers} />

      <EpisodeReadinessPanel
        plan={timeline ? { ...timeline, audioLayers } : null}
      />

      <FullEpisodeTestPanel history={renderHistory} />

      {timeline && (
        <>
          <EpisodeQcPackPanel
            plan={{ ...timeline, audioLayers }}
            disabled={
              rendering ||
              building ||
              transcribing ||
              missingMedia.length > 0
            }
          />
        </>
      )}

      <section className="pipeline">
        <div>
          <p className="eyebrow">EDITING PIPELINE</p>
          <h3>Story map → Visual Brain → timeline → multitrack MP4</h3>
        </div>
        <div className="pipelineActions">
          <button className="primary" disabled={!ready || building || rendering || transcribing} onClick={buildTimeline}>
            {building ? "Building timeline..." : timeline ? "Rebuild baseline timeline" : ready ? "Build baseline timeline" : "Add images + narration"}
          </button>
          <button className="exportButton" disabled={!timeline || rendering || building || transcribing || missingMedia.length > 0} onClick={exportVideo}>
            {rendering
              ? `Rendering ${Math.round((renderProgress?.progress ?? 0) * 100)}%...`
              : "Export MP4"}
          </button>
        </div>
      </section>

      {rendering && renderProgress && (
        <section className="renderProgressPanel">
          <div className="renderProgressHeader">
            <div>
              <p className="eyebrow">RENDERING</p>
              <strong>
                {Math.round(renderProgress.progress * 100)}% complete
              </strong>
            </div>
            <span>
              {formatTime(renderProgress.elapsed)} / {formatTime(renderProgress.duration)}
            </span>
          </div>
          <div className="renderProgressTrack">
            <div
              className="renderProgressFill"
              style={{
                width: `${Math.max(
                  1,
                  Math.min(100, renderProgress.progress * 100)
                )}%`
              }}
            />
          </div>
          <p>
            Long renders use a temporary FFmpeg filter script instead of placing
            the complete filter graph on the operating-system command line.
          </p>
        </section>
      )}

      {timeline && (
        <section id="editor-timeline" className="timelinePanel">
          <div className="timelineHeader">
            <div>
              <p className="eyebrow">FIRST CUT</p>
              <h3>{timeline.clips.length} automatic clips</h3>
            </div>
            <div className="timelineMeta">
              <span>{timeline.width}×{timeline.height}</span>
              <span>{timeline.fps} fps</span>
              <span>{formatTime(timeline.duration)}</span>
              <span>{timeline.subtitles.length} subtitles</span>
              <span>{timeline.transitionDuration.toFixed(2)}s transition</span>
            </div>
          </div>

          <div className="track">
            {timeline.clips.map((clip, index) => (
              <div
                className="clip"
                key={clip.id}
                style={{ flexGrow: Math.max(clip.duration, 0.1) }}
                title={fileName(clip.imagePath)}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{fileName(clip.imagePath)}</strong>
                <small>{clip.duration.toFixed(1)}s · {clip.motion}</small>
              </div>
            ))}
          </div>

          <p className="timelineHint">
            Visual Brain can now replace the fallback sequential edit with a timestamp-aligned shot plan. The baseline button remains available as a safe fallback.
          </p>

          <ExportSettingsPanel plan={timeline} onChange={setTimeline} />
          <TimelineEditor plan={timeline} onChange={setTimeline} />
        </section>
      )}
      </section>
    </main>
    </div>
    </>
  );
}
