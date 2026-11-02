import { useEffect, useMemo, useRef, useState } from "react";
import { parseNovelScript } from "./novel-voice-parser";
import { assertMyCutVoiceTimeline, moveMyCutReviewShot, assertMyCutUniqueSelectedImages, computeMyCutImageCuts, buildMyCutShotReview } from "../shared/mycut-image-cuts";
import { readCharacterVoiceLibrary } from "./CharacterVoiceLibrary";
import type { VoiceLine } from "./novel-voice-parser";
import { buildVoiceProductionPlan, prepareVoiceGeneration, authorizeVoiceGeneration, voiceApprovalFingerprint, validateVoiceProductionPlan, voiceBatchProgress, voicePlanSummary } from "./voice-production-plan";

export default function VoiceStudioPanel({ projectId, episodeId }: { projectId?: string | null; episodeId?: string | null }) {
  const activeProjectId = projectId ?? null;
  const activeEpisodeId = episodeId ?? null;
  const [audioCache, setAudioCache] = useState<Record<string, { fingerprint: string; outputPath: string; speaker?: string; text?: string }>>({});
  const [savedVoicePlayer, setSavedVoicePlayer] = useState<{ lineId: string; url: string } | null>(null);
  const [savedVoiceBusy, setSavedVoiceBusy] = useState<string | null>(null);
  const [savedVoiceError, setSavedVoiceError] = useState("");
  const [savedVoiceFilter, setSavedVoiceFilter] = useState("");
  const [savedVoicePage, setSavedVoicePage] = useState(0);
  const [audioCacheReady, setAudioCacheReady] = useState(false);
  const audioCacheIdentity = useRef<string | null>(null);
  const currentAudioIdentity = activeProjectId && activeEpisodeId ? JSON.stringify([activeProjectId, activeEpisodeId]) : null;
  const audioCacheMatchesEpisode = currentAudioIdentity !== null && audioCacheIdentity.current === currentAudioIdentity && audioCacheReady;
  const savedVoiceEntries = useMemo(() => {
    const needle = savedVoiceFilter.trim().toLocaleLowerCase();
    return Object.entries(audioCache)
      .filter(([lineId, entry]) => entry.outputPath && (!needle ||
        [lineId, entry.speaker ?? "", entry.text ?? "", entry.outputPath.split(/[\\/]/).pop() ?? ""]
          .some(part => part.toLocaleLowerCase().includes(needle))))
      .sort(([first], [second]) => first.localeCompare(second, undefined, { numeric: true }));
  }, [audioCache, savedVoiceFilter]);
  const savedVoiceTotalPages = Math.max(1, Math.ceil(savedVoiceEntries.length / 20));
  const playSavedVoice = async (lineId: string, outputPath: string) => {
    if (!activeProjectId || !activeEpisodeId || !audioCacheMatchesEpisode) return;
    if (savedVoicePlayer?.lineId === lineId) { setSavedVoicePlayer(null); return; }
    setSavedVoiceError("");
    setSavedVoiceBusy(lineId);
    const identity = currentAudioIdentity;
    try {
      const url = await window.videoEditor.previewStudioVoiceAudio(activeProjectId, activeEpisodeId, outputPath);
      if (identity === audioCacheIdentity.current) setSavedVoicePlayer({ lineId, url });
    } catch (error) {
      if (identity === audioCacheIdentity.current) setSavedVoiceError("เปิดเสียงไม่สำเร็จ: " + String(error));
    } finally { setSavedVoiceBusy(null); }
  };
  const revealSavedVoice = async (outputPath: string) => {
    if (!activeProjectId || !activeEpisodeId || !audioCacheMatchesEpisode) return;
    setSavedVoiceError("");
    try {
      await window.videoEditor.revealStudioVoiceAudio(activeProjectId, activeEpisodeId, outputPath);
    } catch (error) { setSavedVoiceError("เปิดโฟลเดอร์ไม่สำเร็จ: " + String(error)); }
  };
  useEffect(() => {
    let active = true;
    audioCacheIdentity.current = null;
    setSavedVoicePlayer(null);
    setSavedVoiceError("");
    setSavedVoiceFilter("");
    setSavedVoicePage(0);
    setAudioCache({});
    setAudioCacheReady(false);
    if (!activeProjectId || !activeEpisodeId) return () => { active = false; };
    const identity = JSON.stringify([activeProjectId, activeEpisodeId]);
    void window.videoEditor.loadStudioEpisodeVoiceAudio(activeProjectId, activeEpisodeId)
      .then(entries => {
        if (active && identity === JSON.stringify([projectIdentity.current, activeEpisodeId])) {
          audioCacheIdentity.current = identity;
          setAudioCache(entries);
          setAudioCacheReady(true);
        }
      })
      .catch(() => { if (active) setAudioCacheReady(false); });
    return () => { active = false; };
  }, [activeProjectId, activeEpisodeId]);
  const projectIdentity = useRef(activeProjectId);
  projectIdentity.current = activeProjectId;
  const [script, setScript] = useState("");
  const [removeBlankLines, setRemoveBlankLines] = useState(false);
  const normalizeBlankLines = (value: string) => value.split(/\r?\n/).filter(line => line.trim().length > 0).join("\n");
  const MAX_SCRIPT_CHARACTERS = 40000;
  const scriptTooLong = script.length > MAX_SCRIPT_CHARACTERS;
  const [analyzedSource, setAnalyzedSource] = useState<string | null>(null);
  const sourceIsStale = analyzedSource !== null && script !== analyzedSource;
  const [lines, setLines] = useState<VoiceLine[]>([]);
  // Never carry a previous episode's script, speaker decisions, or approval into another episode.
  useEffect(() => {
    setScript("");
    setAnalyzedSource(null);
    setLines([]);
    setConfirmed(false);
    setImportedPlanWorkspaceId(null);
    setPlanMessage("");
    setPreviewLineId(null);
  }, [activeProjectId, activeEpisodeId]);

  const [filter, setFilter] = useState<"all" | "review">("all");
  const [voiceIds, setVoiceIds] = useState<Record<string, string>>(() => {
    try {
      const id = localStorage.getItem("voice-studio-selected-workspace-v1") || "workspace-1";
      const data: unknown = JSON.parse(localStorage.getItem(`voice-studio-voice-map-v2:${id}`) || "{}");
      return data && typeof data === "object" && !Array.isArray(data)
        ? Object.fromEntries(Object.entries(data).filter(([key, value]) => key.length <= 150 && typeof value === "string" && value.length <= 250)) as Record<string, string>
        : {};
    } catch { return {}; }
  });
  useEffect(() => {
    const applyLibrary = () => {
      const saved = readCharacterVoiceLibrary();
      setVoiceIds(previous => {
        let changed = false;
        const next = { ...previous };
        for (const [name, id] of Object.entries(saved)) {
          if (!next[name] && id.trim()) { next[name] = id; changed = true; }
        }
        return changed ? next : previous;
      });
    };
    applyLibrary();
    window.addEventListener("character-voices-updated", applyLibrary);
    return () => window.removeEventListener("character-voices-updated", applyLibrary);
  }, []);
  const [projectVoiceIds, setProjectVoiceIds] = useState<Record<string, string>>({});
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);
  const voiceLoadRevision = useRef(0);
  const projectVoicesReady = !activeProjectId || loadedProjectId === activeProjectId;
  useEffect(() => {
    let active = true;
    const loadRevision = ++voiceLoadRevision.current;
    setProjectVoiceIds({});
    setLoadedProjectId(null);
    setConfirmed(false);
    if (activeProjectId) {
      void window.videoEditor.loadStudioCharacterVoices(activeProjectId)
        .then(voices => { if (active && voiceLoadRevision.current === loadRevision) { setProjectVoiceIds(voices); setLoadedProjectId(activeProjectId); } })
        .catch(() => { if (active && voiceLoadRevision.current === loadRevision) setWorkspaceMessage("โหลดเสียงตัวละครของโปรเจกต์ไม่สำเร็จ กรุณากลับไปตรวจคลังเสียง"); });
    }
    return () => { active = false; };
  }, [activeProjectId]);
  useEffect(() => {
    if (!activeProjectId) return;
    let revision = 0;
    const refresh = () => {
      const currentRevision = ++revision;
      const loadRevision = ++voiceLoadRevision.current;
      void window.videoEditor.loadStudioCharacterVoices(activeProjectId)
        .then(voices => {
          if (projectIdentity.current !== activeProjectId || currentRevision !== revision || voiceLoadRevision.current !== loadRevision) return;
          setProjectVoiceIds(voices);
          setLoadedProjectId(activeProjectId);
          setConfirmed(false);
        })
        .catch(() => {
          if (projectIdentity.current === activeProjectId && currentRevision === revision && voiceLoadRevision.current === loadRevision)
            setWorkspaceMessage("รีเฟรชคลังเสียงของโปรเจกต์ไม่สำเร็จ");
        });
    };
    window.addEventListener("character-voices-updated", refresh);
    return () => { revision++; window.removeEventListener("character-voices-updated", refresh); };
  }, [activeProjectId]);
  const [savingProjectVoice, setSavingProjectVoice] = useState(false);
  const voiceSaveGeneration = useRef(0);
  const voiceSaveInFlight = useRef(false);
  useEffect(() => { voiceSaveGeneration.current++; voiceSaveInFlight.current = false; setSavingProjectVoice(false); }, [activeProjectId]);
  const saveProjectSpeakerVoice = async (speaker: string, voiceId: string) => {
    if (!activeProjectId || !projectVoicesReady || voiceSaveInFlight.current) return;
    voiceSaveInFlight.current = true;
    const generation = ++voiceSaveGeneration.current;
    // A pending refresh must not replace the result of this newer save.
    ++voiceLoadRevision.current;
    setSavingProjectVoice(true);
    try {
      const next = await window.videoEditor.patchStudioCharacterVoice(activeProjectId, speaker, voiceId);
      if (projectIdentity.current === activeProjectId && voiceSaveGeneration.current === generation) {
        setProjectVoiceIds(next);
        setConfirmed(false);
        window.dispatchEvent(new Event("character-voices-updated"));
      }
    } catch (error) {
      if (projectIdentity.current === activeProjectId && voiceSaveGeneration.current === generation) setWorkspaceMessage("บันทึกเสียงตัวละครของโปรเจกต์ไม่สำเร็จ: " + String(error));
    } finally { if (projectIdentity.current === activeProjectId && voiceSaveGeneration.current === generation) { voiceSaveInFlight.current = false; setSavingProjectVoice(false); } }
  };
  // A project must never inherit voice assignments from another workspace or project.
  const resolvedVoiceIds = activeProjectId ? (projectVoicesReady ? projectVoiceIds : {}) : voiceIds;
  const [availableVoices, setAvailableVoices] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [voiceLoadError, setVoiceLoadError] = useState("");
  const loadVoices = async () => {
    setLoadingVoices(true);
    setVoiceLoadError("");
    try { setAvailableVoices(await window.videoEditor.listElevenLabsVoices()); }
    catch { setVoiceLoadError("โหลดรายชื่อเสียงไม่สำเร็จ กรุณาตรวจสอบสิทธิ์ Voices: Read"); }
    finally { setLoadingVoices(false); }
  };
  const [, setConfirmed] = useState(false);
  const [findSpeaker, setFindSpeaker] = useState("");
  const [replaceSpeaker, setReplaceSpeaker] = useState("");
  const [planMessage, setPlanMessage] = useState("");
  const [draftName, setDraftName] = useState("ตอนที่ 1");
  const [previewLineId, setPreviewLineId] = useState<string | null>(null);
  const [realWorkspaces, setRealWorkspaces] = useState<Array<{ id: string; name: string; configured: boolean }>>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [selectedModelId, setSelectedModelId] = useState<"eleven_v4" | "eleven_v3">("eleven_v4");
  const [workspaceMessage, setWorkspaceMessage] = useState("");
  const [importedPlanWorkspaceId, setImportedPlanWorkspaceId] = useState<string | null>(null);
  const [workspaceCredits, setWorkspaceCredits] = useState<{ used: number | null; limit: number | null; remaining: number | null; resetAt: number | null } | null>(null);
  const readWorkspaceVoices = (id: string): Record<string, string> => {
    try {
      const data: unknown = JSON.parse(localStorage.getItem(`voice-studio-voice-map-v2:${id}`) || "{}");
      return data && typeof data === "object" && !Array.isArray(data) ? Object.fromEntries(Object.entries(data).filter(([k,v]) => k.length <= 150 && typeof v === "string" && v.length <= 250)) as Record<string,string> : {};
    } catch { return {}; }
  };
  const syncWorkspaces = async () => {
    try {
      const result = await window.videoEditor.listElevenLabsWorkspaces();
      setRealWorkspaces(result.workspaces);
      setSelectedWorkspaceId(result.activeId);
      setWorkspaceMessage(result.workspaces.length ? "" : "กรุณาเพิ่มบัญชี ElevenLabs ในหน้าตั้งค่าเสียง");
    } catch (error) { setWorkspaceMessage(error instanceof Error ? error.message : "อ่านบัญชีไม่สำเร็จ"); }
  };
  useEffect(() => {
    void syncWorkspaces();
    const onChange = () => { void syncWorkspaces(); setWorkspaceCredits(null); setConfirmed(false); };
    window.addEventListener("elevenlabs-workspace-changed", onChange);
    return () => window.removeEventListener("elevenlabs-workspace-changed", onChange);
  }, []);
  const switchRealWorkspace = async (id: string) => {
    if (id === selectedWorkspaceId) return;
    setWorkspaceMessage("กำลังสลับบัญชี...");
    try {
      await window.videoEditor.selectElevenLabsWorkspace(id);
      setWorkspaceCredits(null); setAvailableVoices([]); setConfirmed(false);
      await syncWorkspaces();
      window.dispatchEvent(new Event("elevenlabs-workspace-changed"));
    } catch (error) { setWorkspaceMessage(error instanceof Error ? error.message : "สลับบัญชีไม่สำเร็จ"); }
  };
  const refreshRealCredits = async () => {
    setWorkspaceMessage("กำลังตรวจสอบเครดิตจริง...");
    try { setWorkspaceCredits(await window.videoEditor.getElevenLabsSubscription()); setWorkspaceMessage(""); }
    catch (error) { setWorkspaceCredits(null); setWorkspaceMessage(error instanceof Error ? error.message : "ตรวจสอบเครดิตไม่สำเร็จ"); }
  };
  useEffect(() => {
    if (!selectedWorkspaceId) return;
    setVoiceIds({ ...readCharacterVoiceLibrary(), ...readWorkspaceVoices(selectedWorkspaceId) });
    setConfirmed(false);
  }, [selectedWorkspaceId]);
  useEffect(() => {
    if (!selectedWorkspaceId) return;
    try { localStorage.setItem(`voice-studio-voice-map-v2:${selectedWorkspaceId}`, JSON.stringify(voiceIds)); } catch { /* ignore */ }
  }, [voiceIds]);
  const speakers = useMemo(() => [...new Set(lines.filter(line => line.kind === "dialogue").map(line => line.speaker))], [lines]);
  const reviewCount = lines.filter(line => line.needsReview).length;
  const unresolvedVoiceCount = lines.filter(line => line.kind !== "sfx" && !line.needsReview && !(resolvedVoiceIds[line.speaker] || "").trim()).length;
  const patch = (id: string, change: Partial<VoiceLine>) => { setConfirmed(false); setLines(previous => previous.map(line => line.id === id ? { ...line, ...change } : line)); };
  const renameSpeaker = () => {
    const oldName = findSpeaker.trim();
    const newName = replaceSpeaker.trim();
    if (!oldName || !newName || oldName === newName) return;
    setLines(previous => previous.map(line => line.kind === "dialogue" && line.speaker === oldName ? { ...line, speaker: newName, needsReview: false } : line));
    setVoiceIds(previous => { const next = { ...previous }; if (!next[newName] && next[oldName]) next[newName] = next[oldName]; delete next[oldName]; return next; });
    setConfirmed(false);
    setPlanMessage(`เปลี่ยนชื่อผู้พูด ${oldName} เป็น ${newName} แล้ว กรุณาตรวจทานอีกครั้ง`);
  };
  const importPlan = async (file: File | undefined) => {
    if (!file) return;
    try {
      if (file.size > 5_000_000) throw new Error("ไฟล์ใหญ่เกิน 5 MB");
      const data: unknown = JSON.parse(await file.text());
      if (!data || typeof data !== "object") throw new Error("รูปแบบไฟล์ไม่ถูกต้อง");
      const plan = data as { schemaVersion?: unknown; lines?: unknown; voiceIds?: unknown; title?: unknown; workspaceId?: unknown };
      if (plan.schemaVersion !== 1 || !Array.isArray(plan.lines) || plan.lines.length > 10000) throw new Error("เวอร์ชันหรือรายการบทไม่ถูกต้อง");
      const valid = plan.lines.every((line: unknown) => { const x = line as VoiceLine; return x && typeof x.id === "string" && x.id.length > 0 && x.id.length <= 150 && typeof x.text === "string" && x.text.length <= 10000 && typeof x.speaker === "string" && x.speaker.length <= 150 && typeof x.emotion === "string" && x.emotion.length <= 150 && ["narration", "dialogue", "sfx"].includes(x.kind) && typeof x.needsReview === "boolean"; });
      if (!valid || new Set((plan.lines as VoiceLine[]).map(line => line.id)).size !== plan.lines.length) throw new Error("พบข้อมูลบทพูดหรือ ID ซ้ำไม่ถูกต้อง");
      if (plan.workspaceId !== undefined && (typeof plan.workspaceId !== "string" || !plan.workspaceId.trim() || plan.workspaceId.length > 150)) throw new Error("Workspace ID ไม่ถูกต้อง");
      const map: Record<string, string> = {};
      if (plan.voiceIds && typeof plan.voiceIds === "object" && !Array.isArray(plan.voiceIds)) for (const [key, value] of Object.entries(plan.voiceIds)) if (key.length <= 150 && typeof value === "string" && value.length <= 250) map[key] = value;
      setLines(plan.lines as VoiceLine[]); setAnalyzedSource(null); setScript("");
      setImportedPlanWorkspaceId(typeof plan.workspaceId === "string" ? plan.workspaceId : null);
      if (typeof plan.workspaceId === "string" && plan.workspaceId !== selectedWorkspaceId) {
        setPlanMessage("ไฟล์นี้มาจาก Workspace อื่น: ยังไม่นำเข้า Voice ID กรุณาเลือก Workspace ให้ตรงกันและนำเข้าใหม่");
        setVoiceIds(readWorkspaceVoices(selectedWorkspaceId));
      } else if (typeof plan.workspaceId === "string") { setVoiceIds(map); }
      else { setVoiceIds(readWorkspaceVoices(selectedWorkspaceId)); }
      if (typeof plan.title === "string") setDraftName(plan.title.slice(0, 120));
      setConfirmed(false); setFilter("all");
      if (typeof plan.workspaceId === "string" && plan.workspaceId !== selectedWorkspaceId) setPlanMessage("ไฟล์มาจาก Workspace อื่น ไม่ได้นำ Voice ID ข้าม Workspace กรุณาเลือก Workspace ต้นทางแล้วนำเข้าใหม่");
      else if (plan.workspaceId === undefined) setPlanMessage("นำเข้าไฟล์รุ่นเก่าที่ไม่มี Workspace ID: ไม่คัดลอก Voice ID จากไฟล์ กรุณาตรวจสอบและกำหนดเสียงใหม่");
      else setPlanMessage("นำเข้าแผนเสียงแล้ว กรุณาตรวจสอบและยืนยันใหม่");
    } catch (error) { setPlanMessage(error instanceof Error ? error.message : "นำเข้าไฟล์ไม่สำเร็จ"); }
  };
  const previewLine = (line: VoiceLine) => {
    if (line.kind === "sfx" || !("speechSynthesis" in window)) { setPlanMessage("เครื่องนี้ไม่รองรับการอ่านตัวอย่างผ่านเบราว์เซอร์"); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(line.text);
    utterance.lang = "th-TH";
    utterance.onend = () => setPreviewLineId(null);
    utterance.onerror = () => setPreviewLineId(null);
    setPreviewLineId(line.id);
    window.speechSynthesis.speak(utterance);
  };
  const exportPlan = () => {
    if (!projectVoicesReady || reviewCount > 0 || unresolvedVoiceCount > 0) return;
    const plan = { schemaVersion: 1, title: draftName, createdAt: new Date().toISOString(), workspaceId: selectedWorkspaceId, lines, voiceIds: resolvedVoiceIds };
    const url = URL.createObjectURL(new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "voice-studio-plan.json"; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setPlanMessage("ส่งออกแผนเสียงแล้ว โปรดเก็บไฟล์ JSON ไว้สำหรับขั้นตอนสร้างเสียง");
  };
  const productionPlan = useMemo(() => buildVoiceProductionPlan(draftName, lines, resolvedVoiceIds, audioCacheMatchesEpisode ? audioCache : {}, selectedWorkspaceId, selectedModelId), [draftName, lines, voiceIds, projectVoiceIds, activeProjectId, selectedWorkspaceId, selectedModelId, audioCache, audioCacheMatchesEpisode]);
  const productionSummary = useMemo(() => voicePlanSummary(productionPlan), [productionPlan]);
  const productionErrors = useMemo(() => validateVoiceProductionPlan(productionPlan), [productionPlan]);
  const generationPreflight = useMemo(() => prepareVoiceGeneration(productionPlan), [productionPlan]);
  const batchProgress = useMemo(() => voiceBatchProgress(productionPlan), [productionPlan]);
  const currentQueueFingerprint = useMemo(() => voiceApprovalFingerprint(productionPlan), [productionPlan]);
  const [voiceGenerating, setVoiceGenerating] = useState(false);
  const voiceGenerationLock = useRef(false);
  const [voiceGenerationStatus, setVoiceGenerationStatus] = useState("");
  const [batchRunStatus, setBatchRunStatus] = useState<{ done: number; total: number; failed: number } | null>(null);
  const batchCancelRequested = useRef(false);
  const [batchCancelPending, setBatchCancelPending] = useState(false);
  const [batchRunActive, setBatchRunActive] = useState(false);
  const activeEpisodeIdentityRef = useRef(currentAudioIdentity);
  activeEpisodeIdentityRef.current = currentAudioIdentity;
  const batchInputsKey = JSON.stringify([lines, resolvedVoiceIds, selectedWorkspaceId, selectedModelId]);
  const batchInputsKeyRef = useRef(batchInputsKey);
  batchInputsKeyRef.current = batchInputsKey;
  const generateApprovedVoiceBatch = async () => {
    if (voiceGenerationLock.current || !activeProjectId || !activeEpisodeId ||
        !audioCacheMatchesEpisode || !approvalReady) return;
    const authorization = authorizeVoiceGeneration(productionPlan, currentQueueFingerprint, true);
    if (!authorization.canGenerate || authorization.errors.length) {
      setVoiceGenerationStatus(authorization.errors.join(" · ") || "คิวไม่พร้อม");
      return;
    }
    const pending = authorization.pending;
    if (!pending.length || pending.some(job => !job.voiceId)) return;
    const approvedInputsKey = batchInputsKey;
    voiceGenerationLock.current = true;
    batchCancelRequested.current = false;
    setBatchCancelPending(false);
    setVoiceGenerating(true);
    setBatchRunActive(true);
    setBatchRunStatus({ done: 0, total: pending.length, failed: 0 });
    let done = 0;
    let failed = 0;
    let failureDetail = "";
    try {
      for (const job of pending) {
        // Stop if the user switched projects while the preceding request ran.
        if (batchCancelRequested.current || projectIdentity.current !== activeProjectId || activeEpisodeIdentityRef.current !== currentAudioIdentity || batchInputsKeyRef.current !== approvedInputsKey) break;
        setVoiceGenerationStatus(`กำลังสร้างบรรทัด ${job.order + 1} (${done + failed + 1}/${pending.length})`);
        try {
          await window.videoEditor.generateStudioVoiceLine({
            projectId: activeProjectId, episodeId: activeEpisodeId,
            lineId: job.lineId, fingerprint: job.fingerprint,
            text: job.text, voiceId: job.voiceId!, modelId: job.modelId,
            jobId: job.id, speaker: job.speaker, emotion: job.emotion,
            approved: true
          });
          done++;
        } catch (error) {
          failed++;
          failureDetail = `บรรทัด ${job.order + 1} ล้มเหลว: ${error instanceof Error ? error.message : String(error)}`;
          setVoiceGenerationStatus(failureDetail);
          // Avoid further paid requests after a failure; retry requires new approval.
          break;
        } finally {
          setBatchRunStatus({ done, total: pending.length, failed });
          try {
            const entries = await window.videoEditor.loadStudioEpisodeVoiceAudio(activeProjectId, activeEpisodeId);
            if (projectIdentity.current === activeProjectId && activeEpisodeIdentityRef.current === currentAudioIdentity) { setAudioCache(entries); window.dispatchEvent(new Event("studio-voice-audio-updated")); }
          } catch { /* Keep the generation result; reload on reopening the episode. */ }
        }
      }
      const queueChanged = batchInputsKeyRef.current !== approvedInputsKey;
      const episodeChanged = activeEpisodeIdentityRef.current !== currentAudioIdentity || projectIdentity.current !== activeProjectId;
      setVoiceGenerationStatus(`สร้างสำเร็จ ${done}/${pending.length} บรรทัด · ล้มเหลว ${failed}${batchCancelRequested.current ? " · หยุดตามคำสั่งแล้ว" : queueChanged || episodeChanged ? " · หยุดเนื่องจากคิวหรือโปรเจกต์เปลี่ยน" : ""} · กดสร้างเสียงทั้งหมดอีกครั้งเพื่อทำงานที่เหลือ${failureDetail ? ` · สาเหตุ: ${failureDetail}` : ""}`);
    } finally {
      voiceGenerationLock.current = false;
      setVoiceGenerating(false);
      setBatchRunActive(false);
    }
  };
  const [queuePreviewOpen, setQueuePreviewOpen] = useState(false);
  useEffect(() => { setQueuePreviewOpen(false); }, [productionPlan]);
  const approvalReady = projectVoicesReady && !savingProjectVoice && !sourceIsStale &&
    (importedPlanWorkspaceId === null || importedPlanWorkspaceId === selectedWorkspaceId) &&
    (!activeProjectId || !activeEpisodeId || audioCacheMatchesEpisode) &&
    generationPreflight.canGenerate && generationPreflight.errors.length === 0;
  const [myCutTimingPreview, setMyCutTimingPreview] = useState<Array<{ speaker: string; text: string; start: number; end: number }>>([]);
  const [myCutTimingPreviewOpen, setMyCutTimingPreviewOpen] = useState(false);
  useEffect(() => {
    setMyCutTimingPreview([]);
    setMyCutTimingPreviewOpen(false);
  }, [activeProjectId, activeEpisodeId]);
  const previewMyCutVoiceTiming = async () => {
    if (!activeProjectId || !activeEpisodeId || !audioCacheMatchesEpisode || voiceGenerating) return;
    try {
      const manifest = await window.videoEditor.prepareStudioEpisodeMyCutVoiceManifest(activeProjectId, activeEpisodeId);
      const available = new Map(manifest.lines.map(line => [line.lineId, line]));
      const ordered = productionPlan.jobs.map(job => available.get(job.lineId)).filter(
        (line): line is typeof manifest.lines[number] => !!line
      );
      if (!ordered.length || ordered.length !== manifest.lines.length ||
          new Set(productionPlan.jobs.filter(job => available.has(job.lineId)).map(job => job.lineId)).size !== ordered.length) {
        setPlanMessage("รายการ MP3 ไม่ตรงกับคิวเสียงปัจจุบัน หรือมีบรรทัดซ้ำ ไม่สามารถแสดงตัวอย่างเวลาได้");
        setMyCutTimingPreview([]);
        setMyCutTimingPreviewOpen(false);
        return;
      }
      let position = 0;
      const rows = ordered.map((line, index) => {
        const start = position;
        const end = start + line.duration;
        position = end + (index === ordered.length - 1 ? 0 : 0.3);
        return { speaker: line.speaker, text: line.text, start, end };
      });
      assertMyCutVoiceTimeline(rows.map(row => row.start), ordered.map(line => line.duration), position, 0.3);
      setMyCutTimingPreview(rows);
      setMyCutTimingPreviewOpen(true);
      setPlanMessage("แสดงตัวอย่างเวลา A1 จาก MP3 ที่ตรวจสอบแล้ว ไม่มีการสร้างไฟล์หรือใช้เครดิต");
    } catch (error) {
      setMyCutTimingPreview([]);
      setMyCutTimingPreviewOpen(false);
      setPlanMessage(`ดูตัวอย่างเวลา MyCut ไม่สำเร็จ: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  const [myCutReviewImages, setMyCutReviewImages] = useState<Array<{ path: string; preview: string | null; cue: number | null }>>([]);
  const [myCutReviewVoiceDurations, setMyCutReviewVoiceDurations] = useState<number[]>([]);
  const [myCutReviewLineIds, setMyCutReviewLineIds] = useState<string[]>([]);
  const [myCutReviewAudioPaths, setMyCutReviewAudioPaths] = useState<string[]>([]);
  const [myCutReviewAudioHashes, setMyCutReviewAudioHashes] = useState<string[]>([]);
  const myCutReviewTimings = useMemo(() => {
    if (!myCutReviewImages.length || !myCutReviewVoiceDurations.length) return [];
    const starts: number[] = [];
    let end = 0;
    myCutReviewVoiceDurations.forEach((duration, index) => {
      starts.push(end);
      end += duration + (index === myCutReviewVoiceDurations.length - 1 ? 0 : 0.3);
    });
    try {
      const cuts = computeMyCutImageCuts(starts, end, myCutReviewImages.length, myCutReviewImages.map(image => image.cue));
      return buildMyCutShotReview(myCutReviewImages.map(image => image.path), cuts, end);
    } catch {
      return [];
    }
  }, [myCutReviewImages, myCutReviewVoiceDurations]);
  const [myCutReviewLocks, setMyCutReviewLocks] = useState<number[]>([]);
  const [myCutReviewOpen, setMyCutReviewOpen] = useState(false);
  const myCutReviewEpisodeKey = useRef(`${activeProjectId ?? ""}:${activeEpisodeId ?? ""}`);
  // Keep the current episode identity visible to pending async picker callbacks.
  myCutReviewEpisodeKey.current = `${activeProjectId ?? ""}:${activeEpisodeId ?? ""}`;
  useEffect(() => {
    setMyCutReviewImages([]);
    setMyCutReviewVoiceDurations([]);
    setMyCutReviewLineIds([]);
    setMyCutReviewAudioPaths([]);
    setMyCutReviewAudioHashes([]);
    setMyCutReviewLocks([]);
    setMyCutReviewOpen(false);
  }, [activeProjectId, activeEpisodeId]);
  const myCutReviewSelectionLock = useRef(false);
  const [myCutReviewSelecting, setMyCutReviewSelecting] = useState(false);
  const selectMyCutReviewImages = async () => {
    if (myCutReviewSelectionLock.current || myCutExportLock.current || !activeProjectId || !activeEpisodeId) return;
    const requestEpisodeKey = myCutReviewEpisodeKey.current;
    myCutReviewSelectionLock.current = true;
    setMyCutReviewSelecting(true);
    try {
      const picked = await window.videoEditor.selectImages();
      if (requestEpisodeKey !== myCutReviewEpisodeKey.current || !picked.length) return;
      assertMyCutUniqueSelectedImages(picked);
      const manifest = await window.videoEditor.prepareStudioEpisodeMyCutVoiceManifest(activeProjectId!, activeEpisodeId!);
      const lookup = new Map(manifest.lines.map(line => [line.lineId, line.duration]));
      const durations = productionPlan.jobs.map(job => lookup.get(job.lineId)).filter((duration): duration is number => duration !== undefined);
      if (!durations.length || durations.length !== manifest.lines.length ||
          new Set(productionPlan.jobs.filter(job => lookup.has(job.lineId)).map(job => job.lineId)).size !== durations.length) {
        throw new Error("คิว MP3 ไม่ตรงกับรายการปัจจุบัน กรุณาตรวจสอบเสียงก่อนรีวิวภาพ");
      }
      const cues = await window.videoEditor.readMyCutImageCues(picked, durations.length);
      if (requestEpisodeKey !== myCutReviewEpisodeKey.current) return;
      const reviewed = await Promise.all(picked.map(async (path, index) => ({ path, preview: await window.videoEditor.readImagePreview(path), cue: cues[index] })));
      if (requestEpisodeKey !== myCutReviewEpisodeKey.current) return;
      setMyCutReviewVoiceDurations(durations);
      setMyCutReviewLineIds(productionPlan.jobs.map(job => job.lineId));
      const audioById = new Map(manifest.lines.map(line => [line.lineId, line.audio]));
      const reviewedAudioPaths = productionPlan.jobs.map(job => audioById.get(job.lineId) ?? "");
      const reviewedAudioHashes = await window.videoEditor.readMyCutAudioFingerprints(reviewedAudioPaths);
      if (requestEpisodeKey !== myCutReviewEpisodeKey.current) return;
      setMyCutReviewAudioPaths(reviewedAudioPaths);
      setMyCutReviewAudioHashes(reviewedAudioHashes);
      if (reviewed.some(item => !item.preview)) throw new Error("มีภาพที่ไม่สามารถอ่านได้ กรุณาเลือกไฟล์ใหม่");
      setMyCutReviewImages(reviewed);
      setMyCutReviewLocks([]);
      setMyCutReviewOpen(true);
      setPlanMessage("เลือกภาพแล้ว ตรวจลำดับและล็อกช็อตก่อนกด Apply และ Export");
    } catch (error) {
      if (requestEpisodeKey !== myCutReviewEpisodeKey.current) return;
      setPlanMessage(`เลือกภาพสำหรับรีวิวไม่สำเร็จ: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      myCutReviewSelectionLock.current = false;
      setMyCutReviewSelecting(false);
    }
  };
  const moveReviewedMyCutImage = (from: number, to: number) => {
    try {
      const order = moveMyCutReviewShot(myCutReviewImages.map(item => item.path), from, to, myCutReviewLocks);
      const byPath = new Map(myCutReviewImages.map(item => [item.path, item]));
      const proposed = order.map(path => byPath.get(path)!);
      // Never strand the user in a cue-conflicting shot order: validate before applying.
      if (myCutReviewVoiceDurations.length) {
        const starts: number[] = [];
        let total = 0;
        myCutReviewVoiceDurations.forEach((duration, index) => {
          starts.push(total);
          total += duration + (index === myCutReviewVoiceDurations.length - 1 ? 0 : 0.3);
        });
        computeMyCutImageCuts(starts, total, proposed.length, proposed.map(image => image.cue));
      }
      setMyCutReviewImages(proposed);
    } catch (error) {
      setPlanMessage(error instanceof Error ? error.message : String(error));
    }
  };
  const myCutExportLock = useRef(false);
  const [myCutExportPending, setMyCutExportPending] = useState(false);
  const exportMyCutProject = async (withImages = false, reviewedImages?: string[]) => {
    if (!activeProjectId || !activeEpisodeId || !audioCacheMatchesEpisode || voiceGenerating || myCutExportLock.current) return;
    myCutExportLock.current = true;
    setMyCutExportPending(true);
    try {
      const manifest = await window.videoEditor.prepareStudioEpisodeMyCutVoiceManifest(activeProjectId, activeEpisodeId);
      const available = new Set(manifest.lines.map(line => line.lineId));
      const ordered = productionPlan.jobs
        .filter(job => available.has(job.lineId))
        .map(job => job.lineId);
      if (!ordered.length) {
        setPlanMessage("ยังไม่มี MP3 ที่พร้อมส่งออก MyCut สำหรับคิวเสียงปัจจุบัน");
        return;
      }
      if (ordered.length !== manifest.lines.length || new Set(ordered).size !== ordered.length) {
        setPlanMessage("รายการ MP3 ไม่ตรงกับคิวเสียงปัจจุบัน หรือมีบรรทัดซ้ำ กรุณาตรวจสอบก่อนส่งออกเพื่อป้องกันเรียงผิด");
        return;
      }
      if (reviewedImages && (ordered.length !== myCutReviewLineIds.length || ordered.some((id, index) => id !== myCutReviewLineIds[index]))) {
        setPlanMessage("คิวเสียงเปลี่ยนหลังรีวิวภาพ กรุณาเลือกภาพและตรวจเวลา V1 ใหม่ก่อนส่งออก");
        return;
      }
      if (reviewedImages) {
        // Re-read verified MP3 metadata: an identical line order can still have replacement audio.
        const durationsById = new Map(manifest.lines.map(line => [line.lineId, line.duration]));
        const freshDurations = ordered.map(id => durationsById.get(id));
        const audioById = new Map(manifest.lines.map(line => [line.lineId, line.audio]));
        const freshAudioPaths = ordered.map(id => audioById.get(id));
        if (freshAudioPaths.length !== myCutReviewAudioPaths.length ||
            freshAudioPaths.some((audio, index) => !audio || audio !== myCutReviewAudioPaths[index])) {
          setPlanMessage("ไฟล์เสียง MP3 ที่ใช้เปลี่ยนหลังรีวิวภาพ กรุณาตรวจภาพ V1 ใหม่ก่อนส่งออก");
          return;
        }
        const freshHashes = await window.videoEditor.readMyCutAudioFingerprints(freshAudioPaths as string[]);
        if (freshHashes.length !== myCutReviewAudioHashes.length ||
            freshHashes.some((hash, index) => hash !== myCutReviewAudioHashes[index])) {
          setPlanMessage("ข้อมูล MP3 ถูกเปลี่ยนหลังรีวิวภาพ กรุณาตรวจเวลา V1 ใหม่ก่อนส่งออก");
          return;
        }
        if (freshDurations.length !== myCutReviewVoiceDurations.length ||
            freshDurations.some((duration, index) =>
              duration === undefined || !Number.isFinite(duration) ||
              Math.abs(duration - myCutReviewVoiceDurations[index]) > 1e-6)) {
          setPlanMessage("ไฟล์ MP3 หรือความยาวเสียงเปลี่ยนหลังรีวิวภาพ กรุณาเลือกภาพและตรวจเวลา V1 ใหม่ก่อนส่งออก");
          return;
        }
      }
      const result = await window.videoEditor.exportStudioEpisodeToMyCut(activeProjectId, activeEpisodeId, ordered, withImages, reviewedImages, reviewedImages ? myCutReviewAudioHashes : undefined);
      setPlanMessage(result
        ? `สร้างโปรเจกต์ MyCut ใหม่แล้ว: ${result.audioClips} คลิปเสียง · ${result.duration.toFixed(2)} วินาที · ${result.path}${withImages ? " (เพิ่มภาพบน V1 แล้ว)" : " (ยังไม่มีภาพบน V1)"}`
        : "ยกเลิกการส่งออก MyCut แล้ว");
    } catch (error) {
      setPlanMessage(`สร้างโปรเจกต์ MyCut ไม่สำเร็จ: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      myCutExportLock.current = false;
      setMyCutExportPending(false);
    }
  };
  const exportExistingMyCutVoices = async () => {
    if (!activeProjectId || !activeEpisodeId || !audioCacheMatchesEpisode) return;
    try {
      const manifest = await window.videoEditor.prepareStudioEpisodeMyCutVoiceManifest(activeProjectId, activeEpisodeId);
      if (manifest.lines.length === 0) {
        setPlanMessage("ยังไม่มี MP3 ที่ตรวจสอบแล้วในตอนนี้ จึงยังไม่สามารถส่งออกเสียงสำหรับ MyCut");
        return;
      }
      // Sort from the verified voice production queue, not random UUID or generation timestamp.
      const queueOrder = new Map(productionPlan.jobs.map((job, index) => [job.lineId, index]));
      manifest.lines.sort((a, b) => (queueOrder.get(a.lineId) ?? Number.MAX_SAFE_INTEGER) - (queueOrder.get(b.lineId) ?? Number.MAX_SAFE_INTEGER));
      const url = URL.createObjectURL(new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "mycut-voice-manifest.json";
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setPlanMessage(`ส่งออกรายการ MP3 สำหรับ MyCut ${manifest.lines.length} บรรทัดแล้ว (เสียงพัก 0.3 วินาที) ยังไม่ได้สร้าง .mycut หรือใช้เครดิต AI`);
    } catch (error) {
      setPlanMessage(`ส่งออก MyCut ไม่สำเร็จ: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  const exportProductionPlan = () => {
    if (!projectVoicesReady || sourceIsStale || (importedPlanWorkspaceId !== null && importedPlanWorkspaceId !== selectedWorkspaceId) || productionSummary.blocked || productionErrors.length || (!!activeProjectId && !!activeEpisodeId && !audioCacheMatchesEpisode)) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(productionPlan, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "voice-production-queue.json"; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setPlanMessage("ส่งออกคิวเตรียมสร้างเสียงแล้ว ยังไม่มีการเรียก API หรือหักเครดิต");
  };
  const allSpeakers = useMemo(() => [...new Set(lines.filter(line => line.kind !== "sfx").map(line => line.speaker))], [lines]);
  return <section className="voiceStudioPanel" id="voice-studio">
    <header><div><p className="eyebrow">AI VOICE STUDIO · ขั้นเตรียมบท</p><h2>แยกบทนิยายและผู้พูด</h2><p className="muted">วางนิยายทั้งตอน ระบบจะแยกคำบรรยายและบทสนทนา พร้อมทำเครื่องหมายจุดที่ยังไม่ทราบผู้พูด ก่อนเชื่อมต่อระบบสร้างเสียง</p></div></header>
    <section className="voiceRegistry" aria-label="คลัง MP3 ที่สร้างแล้วในตอนนี้">
      <h3>🎧 ฟังเสียงที่สร้างแล้ว · เปิดโฟลเดอร์ MP3</h3>
      <p className="muted">ฟังเสียง ElevenLabs ที่บันทึกไว้จริงได้ทันที หรือเปิด Windows Explorer โดยเลือกไฟล์ให้พร้อมคัดลอก ไม่เรียก API และไม่ใช้เครดิตเพิ่ม</p>
      {!activeProjectId || !activeEpisodeId ? <p>เลือกโปรเจกต์และ EP ก่อนเพื่อดูไฟล์เสียงของตอนนั้น</p>
        : !audioCacheMatchesEpisode ? <p role="status">กำลังอ่านไฟล์เสียงที่บันทึกไว้ใน EP…</p>
        : <>
          <div className="voiceStudioActions">
            <strong>ไฟล์ MP3 ที่บันทึกไว้ {Object.values(audioCache).filter(entry => entry.outputPath).length} ไฟล์</strong>
            <label>ค้นหาไฟล์เสียง <input aria-label="ค้นหา MP3 ที่สร้างแล้ว" value={savedVoiceFilter} onChange={event => { setSavedVoiceFilter(event.target.value); setSavedVoicePage(0); }} placeholder="บรรทัด / ตัวละคร / เนื้อหา" /></label>
            {savedVoiceEntries.length > 0 && <button type="button" onClick={() => { void revealSavedVoice(savedVoiceEntries[0][1].outputPath); }}>📂 เปิดโฟลเดอร์เสียงของ EP</button>}
          </div>
          {savedVoiceEntries.length === 0 ? <p className="muted">{savedVoiceFilter ? "ไม่พบไฟล์ที่ตรงกับคำค้น" : "ยังไม่มี MP3 ที่สร้างไว้ในตอนนี้ เมื่อสร้างเสียงเสร็จ ไฟล์จะปรากฏที่นี่อัตโนมัติ"}</p>
            : <div className="voiceStudioLines">
              {savedVoiceEntries.slice(savedVoicePage * 20, (savedVoicePage + 1) * 20).map(([lineId, entry]) =>
                <div className="voiceStudioLine" key={lineId}>
                  <strong>{lineId} · {entry.speaker || "เสียงพากย์"}</strong>
                  {entry.text && <p className="muted">{entry.text.slice(0, 160)}{entry.text.length > 160 ? "…" : ""}</p>}
                  <small className="muted">{entry.outputPath.split(/[\\/]/).pop()}</small>
                  <div className="voiceStudioActions">
                    <button type="button" disabled={savedVoiceBusy === lineId} onClick={() => { void playSavedVoice(lineId, entry.outputPath); }}>{savedVoiceBusy === lineId ? "กำลังเปิดเสียง…" : savedVoicePlayer?.lineId === lineId ? "■ ปิดเสียง" : "▶ ฟัง MP3"}</button>
                    <button type="button" onClick={() => { void revealSavedVoice(entry.outputPath); }}>📂 เปิดตำแหน่งไฟล์</button>
                  </div>
                  {savedVoicePlayer?.lineId === lineId && <audio key={savedVoicePlayer.url} src={savedVoicePlayer.url} controls autoPlay preload="metadata" onEnded={() => setSavedVoicePlayer(null)} onError={() => setSavedVoiceError("เล่นไฟล์ MP3 นี้ไม่สำเร็จ")} aria-label={`ฟังเสียงบรรทัด ${lineId}`} />}
                </div>)}
            </div>}
          {savedVoiceTotalPages > 1 && <div className="voiceStudioActions">
            <button type="button" disabled={savedVoicePage === 0} onClick={() => setSavedVoicePage(page => Math.max(0, page - 1))}>ก่อนหน้า</button>
            <span>หน้า {Math.min(savedVoicePage + 1, savedVoiceTotalPages)} / {savedVoiceTotalPages}</span>
            <button type="button" disabled={savedVoicePage + 1 >= savedVoiceTotalPages} onClick={() => setSavedVoicePage(page => Math.min(savedVoiceTotalPages - 1, page + 1))}>ถัดไป</button>
          </div>}
        </>}
      {savedVoiceError && <p role="alert">{savedVoiceError}</p>}
    </section>
    <div className="voiceStudioActions"><label>ชื่อตอน <input value={draftName} onChange={event => { setDraftName(event.target.value); setConfirmed(false); }} /></label><label>เปิดแผนเสียงเดิม <input type="file" accept=".json,application/json" onChange={event => { void importPlan(event.target.files?.[0]); event.target.value = ""; }} /></label></div>
    <div className="voiceStudioGrid">
      <div><label htmlFor="voice-novel-input">ต้นฉบับนิยาย</label><textarea id="voice-novel-input" rows={12} aria-describedby="voice-script-character-count" value={script} onChange={event => { setScript(event.target.value); setConfirmed(false); }} placeholder={'สิงห์หยุดเดิน\n"หยุดก่อน" สิงห์กระซิบ\n[พูด: พรานอิน | อารมณ์: หวาดระแวง] ข้าได้ยินเสียง'} /><label style={{display:"flex",alignItems:"center",gap:8,margin:"8px 0"}}><input type="checkbox" checked={removeBlankLines} onChange={event => setRemoveBlankLines(event.target.checked)} />ลบบรรทัดว่างก่อนวิเคราะห์ (ไม่ลบข้อความ)</label><button type="button" disabled={!script.trim() || !removeBlankLines || normalizeBlankLines(script) === script} onClick={() => { setScript(normalizeBlankLines(script)); setConfirmed(false); }}>ลบบรรทัดว่างในกล่องข้อความ</button><button className="primary" disabled={!script.trim() || scriptTooLong} onClick={() => { setLines(parseNovelScript(script)); setImportedPlanWorkspaceId(null); setAnalyzedSource(script); setFilter("all"); setConfirmed(false); }}>วิเคราะห์และแยกบท</button><p id="voice-script-character-count" role={scriptTooLong ? "alert" : undefined} className="muted">{script.length.toLocaleString()} / {MAX_SCRIPT_CHARACTERS.toLocaleString()} ตัวอักษร{scriptTooLong ? " — เกินขีดจำกัด กรุณาแบ่งต้นฉบับเป็นช่วงก่อนวิเคราะห์ (ระบบจะไม่ตัดข้อความอัตโนมัติ)" : ""}</p><p className="muted">กฎกำกับ: [บรรยาย | อารมณ์: ลึกลับ], [พูด: พรานสิง | อารมณ์: กระซิบ], [SFX: เสียงฝน] · คำกำกับไม่ถูกนำไปเป็นบทพูด</p></div>
      <div><strong>ผลการแยกบท</strong><p className="muted">{lines.length} ช่วง · {speakers.length} ผู้พูด · {reviewCount} จุดรอตรวจสอบ</p><div className="voiceStudioActions"><button onClick={() => setFilter("all")}>ทั้งหมด</button><button onClick={() => setFilter("review")}>รอตรวจสอบ ({reviewCount})</button></div><div className="voiceStudioLines">{lines.filter(line => filter === "all" || line.needsReview).map(line => <div key={line.id} className="voiceStudioLine"><span>{line.kind === "sfx" ? "เอฟเฟกต์" : line.kind === "narration" ? "บรรยาย" : "บทพูด"} {line.needsReview ? "⚠ ตรวจสอบผู้พูด" : ""}</span><textarea rows={2} value={line.text} onChange={event => patch(line.id, { text: event.target.value })}/>{line.kind !== "sfx" && <button onClick={() => previewLine(line)}>{previewLineId === line.id ? "กำลังอ่านตัวอย่าง..." : "ฟังตัวอย่างฟรี (เสียงเครื่อง)"}</button>}{line.kind === "dialogue" && <label>ผู้พูด <input value={line.speaker} onChange={event => patch(line.id, { speaker: event.target.value, needsReview: !event.target.value.trim() || event.target.value === "ไม่ทราบผู้พูด" })}/></label>}<label>อารมณ์ <input value={line.emotion} onChange={event => patch(line.id, { emotion: event.target.value })}/></label></div>)}</div></div>
    </div>
    {lines.length > 0 && <div className="voiceRegistry"><h3>จัดการชื่อผู้พูดทั้งตอน</h3><p className="muted">รวมชื่อที่ AI แยกต่างกัน เช่น สิงห์ และ พรานสิง โดยเปลี่ยนทุกบทพร้อมกัน</p><label>ชื่อเดิม<input value={findSpeaker} onChange={event => setFindSpeaker(event.target.value)} list="voice-speaker-names" placeholder="เช่น สิงห์" /></label><datalist id="voice-speaker-names">{speakers.map(name => <option key={name} value={name} />)}</datalist><label>ชื่อใหม่<input value={replaceSpeaker} onChange={event => setReplaceSpeaker(event.target.value)} placeholder="เช่น พรานสิง" /></label><button disabled={!findSpeaker.trim() || !replaceSpeaker.trim() || findSpeaker.trim() === replaceSpeaker.trim()} onClick={renameSpeaker}>เปลี่ยนชื่อทุกบท</button><h3>คลังเสียงประจำตัวละคร (Voice ID)</h3><button type="button" disabled={loadingVoices} onClick={() => void loadVoices()}>{loadingVoices ? "กำลังโหลดเสียง..." : "ดึงรายชื่อเสียงจาก ElevenLabs"}</button>{voiceLoadError && <p role="alert">{voiceLoadError}</p>}{availableVoices.length > 0 && <p className="muted">พบเสียง {availableVoices.length} รายการ เลือกเสียงให้แต่ละตัวละครได้เลย</p>}<p className="muted">กำหนด ElevenLabs Voice ID สำหรับแต่ละตัวละครและผู้บรรยาย ระบบยังไม่ส่งคำขอสร้างเสียง</p>{allSpeakers.map(speaker => <div key={speaker} className="voiceSpeakerAssignment"><strong>{speaker}</strong><span className="muted">{resolvedVoiceIds[speaker]?.trim() ? "✓ จับคู่เสียงแล้ว" : "⚠ ยังไม่ได้จับคู่เสียง"}</span>{availableVoices.length > 0 && <select aria-label={`เลือกเสียงให้ ${speaker}`} value={availableVoices.some(voice => voice.id === resolvedVoiceIds[speaker]) ? resolvedVoiceIds[speaker] : ""} onChange={event => { if (event.target.value) { setConfirmed(false); if (activeProjectId) { void saveProjectSpeakerVoice(speaker, event.target.value); } else { setVoiceIds(previous => ({ ...previous, [speaker]: event.target.value })); } } }}><option value="">เลือกเสียงจากรายการ</option>{availableVoices.map(voice => <option key={voice.id} value={voice.id}>{voice.name}</option>)}</select>}</div>)}<p className="muted">จุดที่ต้องตรวจสอบ: ผู้พูดไม่ชัดเจน {reviewCount} ช่วง · ยังไม่กำหนด Voice ID {unresolvedVoiceCount} ช่วง</p></div>}
    {lines.length > 0 && <div className="voiceRegistry"><h3>Workspace ElevenLabs (บัญชีจริง)</h3><label>โมเดลสร้างเสียง (ภาษาไทย)<select value={selectedModelId} onChange={event => { setSelectedModelId(event.target.value as "eleven_v4" | "eleven_v3"); setConfirmed(false); }}><option value="eleven_v4">Eleven v4 — แนะนำสำหรับเสียงไทย</option><option value="eleven_v3">Eleven v3 — เสียงแสดงอารมณ์</option></select></label><p>ไฟล์เสียง v2 ที่สร้างไว้เดิมจะไม่ถูกลบ การเปลี่ยนโมเดลต้องยืนยันก่อนสร้างใหม่และใช้เครดิต ElevenLabs</p><div className="voiceStudioActions">
      <label>เลือกบัญชี<select value={selectedWorkspaceId} onChange={event => void switchRealWorkspace(event.target.value)}>{realWorkspaces.map(item => <option key={item.id} value={item.id}>{item.name}{item.configured ? "" : " (ยังไม่มีคีย์)"}</option>)}</select></label>
      <button type="button" onClick={() => void syncWorkspaces()}>โหลดรายการบัญชีใหม่</button>
      <button type="button" disabled={!selectedWorkspaceId} onClick={() => void refreshRealCredits()}>ตรวจสอบเครดิตจริง</button></div>
      {workspaceCredits && <p>ใช้ไป {workspaceCredits.used?.toLocaleString() ?? "ไม่ทราบ"} · ทั้งหมด {workspaceCredits.limit?.toLocaleString() ?? "ไม่ทราบ"} · คงเหลือ <strong>{workspaceCredits.remaining?.toLocaleString() ?? "ไม่ทราบ"}</strong></p>}
      {workspaceMessage && <p role="status">{workspaceMessage}</p>}
      <p className="muted">บัญชีเดียวกับหน้าตั้งค่า ElevenLabs ไม่มีโปรไฟล์จำลองหรือเครดิตกรอกเอง</p></div>}
    {importedPlanWorkspaceId !== null && importedPlanWorkspaceId !== selectedWorkspaceId && <p role="alert">แผนเสียงที่นำเข้ามาจาก Workspace อื่น กรุณาเลือก Workspace ให้ตรงกับไฟล์และนำเข้าใหม่ก่อนส่งออกคิว</p>}
    {sourceIsStale && <p role="alert">ต้นฉบับถูกแก้ไขหลังวิเคราะห์ กรุณากดวิเคราะห์และแยกบทอีกครั้งก่อนส่งออกคิวเสียง</p>}
    {lines.length > 0 && <div className="voiceRegistry">
      <h3>สร้างเสียง ElevenLabs</h3>
      <p className="muted">ตรวจบทพูดและเสียงตัวละครด้านบน แล้วกดสร้างเสียงทั้งหมดเพียงครั้งเดียว ระบบสร้าง MP3 ที่ยังขาดตามลำดับและใช้ไฟล์ที่สร้างสำเร็จไว้แล้วโดยอัตโนมัติ</p>
      <p>รอสร้าง {generationPreflight.pending.length} บรรทัด · MP3 เดิม {generationPreflight.reused.length} บรรทัด · คิดเครดิตประมาณ {generationPreflight.estimatedCharacters.toLocaleString()} ตัวอักษร</p>
      <div className="voiceStudioActions">
        <button type="button" className="primary" disabled={!approvalReady || voiceGenerating || !activeProjectId || !activeEpisodeId} onClick={() => { void generateApprovedVoiceBatch(); }}>
          {voiceGenerating ? "กำลังสร้างเสียง…" : "สร้างเสียงทั้งหมด"}
        </button>
        {batchRunActive && voiceGenerating && <button type="button" disabled={batchCancelPending} onClick={() => { batchCancelRequested.current = true; setBatchCancelPending(true); }}>หยุดหลังบรรทัดปัจจุบัน</button>}
      </div>
      {!approvalReady && <p role="alert">ยังสร้างไม่ได้: {generationPreflight.errors.slice(0,2).join(" · ") || (sourceIsStale ? "วิเคราะห์ข้อความที่แก้ไขอีกครั้ง" : !projectVoicesReady ? "กำลังโหลดคลังเสียง" : !audioCacheMatchesEpisode ? "กำลังโหลด MP3 เดิม" : "ตรวจบทและเสียงตัวละครที่ยังไม่ครบ")}</p>}
      {batchRunStatus && <div className="voiceBatchProgress"><label htmlFor="voice-paid-batch-progress">ความคืบหน้า {batchRunStatus.done + batchRunStatus.failed}/{batchRunStatus.total} บรรทัด</label><progress id="voice-paid-batch-progress" max={batchRunStatus.total} value={batchRunStatus.done + batchRunStatus.failed}/><p role="status">สำเร็จ {batchRunStatus.done} · ล้มเหลว {batchRunStatus.failed}</p></div>}
      {voiceGenerationStatus && <p role="status">{voiceGenerationStatus}</p>}
      <details><summary>เครื่องมือเพิ่มเติม (JSON / MyCut / ตรวจคิว)</summary>
        <p>มี MP3 แล้ว {batchProgress.completed}/{batchProgress.total} บรรทัด · ต้องแก้ไข {productionSummary.blocked} บรรทัด</p>
        <button type="button" onClick={() => setQueuePreviewOpen(open => !open)}>{queuePreviewOpen ? "ซ่อนคิว" : "ดูรายการเสียง"}</button>
        {queuePreviewOpen && <ol>{productionPlan.jobs.map(job => <li key={job.id}>{job.order + 1}. {job.speaker} · {job.state === "completed" ? "สร้างแล้ว" : job.state === "ready" ? "รอสร้าง" : "ต้องตรวจสอบ"}</li>)}</ol>}
        <div className="voiceStudioActions">
          <button type="button" disabled={!projectVoicesReady || reviewCount > 0 || unresolvedVoiceCount > 0} onClick={exportPlan}>บันทึกแผนเสียง JSON</button>
          <button type="button" disabled={!projectVoicesReady || sourceIsStale || productionSummary.blocked > 0} onClick={exportProductionPlan}>ส่งออกคิว JSON</button>
          <button type="button" disabled={!activeProjectId || !activeEpisodeId || !audioCacheMatchesEpisode || voiceGenerating} onClick={() => { void previewMyCutVoiceTiming(); }}>ดูเวลาเสียง MyCut</button>
          <button type="button" disabled={!activeProjectId || !activeEpisodeId || !audioCacheMatchesEpisode || voiceGenerating} onClick={() => { void exportExistingMyCutVoices(); }}>ส่งออก MP3 สำหรับ MyCut</button>
          <button type="button" disabled={!activeProjectId || !activeEpisodeId || !audioCacheMatchesEpisode || voiceGenerating || myCutExportPending} onClick={() => { void exportMyCutProject(); }}>สร้างโปรเจกต์ MyCut</button>
          <button type="button" disabled={!activeProjectId || !activeEpisodeId || !audioCacheMatchesEpisode || voiceGenerating || myCutExportPending || myCutReviewSelecting} onClick={() => { void selectMyCutReviewImages(); }}>รีวิวภาพสำหรับ MyCut</button>
        </div>
      </details>
    </div>}
    {myCutReviewOpen && <div className="voiceQueuePreview"><h3>Shot Review ภาพ V1</h3><p className="muted">ใช้ภาพจากเครื่องเท่านั้น · เลื่อนลำดับด้วยปุ่ม ↑ ↓ · ล็อกตำแหน่งเพื่อไม่ให้ภาพอื่นเลื่อนผ่าน · กด Apply เพื่ออนุมัติและส่งออกไฟล์ใหม่ · เวลาคำนวณจาก MP3 และ cue ในไฟล์ .txt ที่อ่านตอนเลือกภาพ · ระบบจะตรวจไฟล์อีกครั้งก่อน Save As</p><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12}}>{myCutReviewImages.map((item,index) => <div key={item.path} style={{border:"1px solid #888",borderRadius:8,padding:8}}><img src={item.preview ?? ""} alt={`ภาพช็อต ${index+1}`} style={{width:"100%",height:140,objectFit:"contain"}}/><p>{index+1}. {item.path.split(/[\\/]/).pop()}</p><p className="muted">{myCutReviewTimings[index] ? `${myCutReviewTimings[index].start.toFixed(2)}–${myCutReviewTimings[index].end.toFixed(2)} วินาที` : "ยังคำนวณเวลาไม่ได้"}</p><label><input type="checkbox" checked={myCutReviewLocks.includes(index)} onChange={event => setMyCutReviewLocks(previous => event.target.checked ? [...previous,index] : previous.filter(value => value !== index))}/> ล็อกตำแหน่ง</label><div><button type="button" disabled={index===0 || myCutReviewLocks.includes(index) || myCutReviewLocks.includes(index-1)} onClick={() => moveReviewedMyCutImage(index,index-1)}>↑</button><button type="button" disabled={index===myCutReviewImages.length-1 || myCutReviewLocks.includes(index) || myCutReviewLocks.includes(index+1)} onClick={() => moveReviewedMyCutImage(index,index+1)}>↓</button></div></div>)}</div><div className="voiceStudioActions"><button type="button" onClick={() => setMyCutReviewOpen(false)}>ยกเลิกรีวิว</button><button type="button" className="primary" disabled={myCutExportPending || voiceGenerating || !audioCacheMatchesEpisode || !myCutReviewImages.length || myCutReviewTimings.length !== myCutReviewImages.length} onClick={() => { void exportMyCutProject(true,myCutReviewImages.map(item=>item.path)); }}>Apply และส่งออก .mycut ใหม่</button></div></div>}
    {myCutTimingPreviewOpen && <div className="voiceQueuePreview"><h3>ตัวอย่างไทม์ไลน์ A1 ก่อนส่งออก</h3><p className="muted">ใช้ MP3 เดิมเท่านั้น เว้น 0.3 วินาทีระหว่างบรรทัด ภาพ V1 ต้องแสดงต่อเนื่อง · ไม่มีการแก้ไขไฟล์</p><button type="button" onClick={() => setMyCutTimingPreviewOpen(false)}>ปิดตัวอย่าง</button><ol>{myCutTimingPreview.map((shot, index) => <li key={index}><strong>{shot.speaker}</strong> · {shot.start.toFixed(2)}–{shot.end.toFixed(2)} วินาที · {shot.text.slice(0, 120)}{shot.text.length > 120 ? "…" : ""}</li>)}</ol></div>}
    {planMessage && <p role="status" className="muted">{planMessage}</p>}
    <p className="muted">การฟังตัวอย่างใช้เสียงสังเคราะห์ของระบบปฏิบัติการ ไม่ใช่เสียง ElevenLabs และอาจไม่รองรับภาษาไทยบนบางเครื่อง</p>
    <p className="muted">ขั้นนี้เป็นการแยกบทด้วยกฎและตรวจทานด้วยคน ยังไม่เรียก AI วิเคราะห์บริบทเชิงลึกหรือ ElevenLabs และยังไม่คิดเครดิตสร้างเสียง</p>
  </section>;
}
