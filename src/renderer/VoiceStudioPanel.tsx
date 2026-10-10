import { useEffect, useMemo, useState } from "react";
import { parseNovelScript } from "./novel-voice-parser";
import type { VoiceLine } from "./novel-voice-parser";
import { buildVoiceProductionPlan, voicePlanSummary } from "./voice-production-plan";
import { canScheduleWorkspaceJob } from "./elevenlabs-workspace-profiles";
import type { ElevenLabsWorkspaceProfile } from "./elevenlabs-workspace-profiles";

export default function VoiceStudioPanel() {
  const [script, setScript] = useState("");
  const MAX_SCRIPT_CHARACTERS = 5000;
  const scriptTooLong = script.length > MAX_SCRIPT_CHARACTERS;
  const [analyzedSource, setAnalyzedSource] = useState<string | null>(null);
  const sourceIsStale = analyzedSource !== null && script !== analyzedSource;
  const [lines, setLines] = useState<VoiceLine[]>([]);
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
  const [confirmed, setConfirmed] = useState(false);
  const [findSpeaker, setFindSpeaker] = useState("");
  const [replaceSpeaker, setReplaceSpeaker] = useState("");
  const [planMessage, setPlanMessage] = useState("");
  const [draftName, setDraftName] = useState("ตอนที่ 1");
  const [previewLineId, setPreviewLineId] = useState<string | null>(null);
  const [workspaceProfiles, setWorkspaceProfiles] = useState<Array<{ id: string; label: string; budget: string; used: string }>>(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem("voice-studio-workspaces-v1") || "null");
      if (Array.isArray(saved) && saved.length > 0 && saved.length <= 100 && saved.every(x => x && typeof x.id === "string" && typeof x.label === "string" && typeof x.budget === "string" && typeof x.used === "string")) return saved;
    } catch { /* Ignore corrupted local data. */ }
    return [{ id: "workspace-1", label: "Workspace หลัก", budget: "10000", used: "" }];
  });
  useEffect(() => { try { localStorage.setItem("voice-studio-workspaces-v1", JSON.stringify(workspaceProfiles)); } catch { /* Storage may be unavailable. */ } }, [workspaceProfiles]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(() => {
    try {
      const saved = localStorage.getItem("voice-studio-selected-workspace-v1");
      return saved && workspaceProfiles.some(profile => profile.id === saved) ? saved : workspaceProfiles[0].id;
    } catch { return workspaceProfiles[0].id; }
  });
  useEffect(() => { try { localStorage.setItem("voice-studio-selected-workspace-v1", selectedWorkspaceId); } catch { /* Storage may be unavailable. */ } }, [selectedWorkspaceId]);
  useEffect(() => { try { localStorage.setItem(`voice-studio-voice-map-v2:${selectedWorkspaceId}`, JSON.stringify(voiceIds)); } catch { /* Storage may be unavailable. */ } }, [voiceIds, selectedWorkspaceId]);
  const [workspaceLabel, setWorkspaceLabel] = useState("Workspace หลัก");
  const readWorkspaceVoices = (id: string): Record<string, string> => {
    try {
      const raw: unknown = JSON.parse(localStorage.getItem(`voice-studio-voice-map-v2:${id}`) || "{}");
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
      return Object.fromEntries(Object.entries(raw).filter(([key, value]) => key.length <= 150 && typeof value === "string" && value.length <= 250)) as Record<string, string>;
    } catch { return {}; }
  };
  const [creditBudget, setCreditBudget] = useState("10000");
  const [usedCredits, setUsedCredits] = useState("");
  const [importedPlanWorkspaceId, setImportedPlanWorkspaceId] = useState<string | null>(null);
  const speakers = useMemo(() => [...new Set(lines.filter(line => line.kind === "dialogue").map(line => line.speaker))], [lines]);
  const reviewCount = lines.filter(line => line.needsReview).length;
  const unresolvedVoiceCount = lines.filter(line => line.kind !== "sfx" && !line.needsReview && !(voiceIds[line.speaker] || "").trim()).length;
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
    const plan = { schemaVersion: 1, title: draftName, createdAt: new Date().toISOString(), workspaceId: selectedWorkspaceId, lines, voiceIds };
    const url = URL.createObjectURL(new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "voice-studio-plan.json"; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setPlanMessage("ส่งออกแผนเสียงแล้ว โปรดเก็บไฟล์ JSON ไว้สำหรับขั้นตอนสร้างเสียง");
  };
  useEffect(() => {
    const selected = workspaceProfiles.find(profile => profile.id === selectedWorkspaceId);
    if (!selected) return;
    setWorkspaceLabel(selected.label); setCreditBudget(selected.budget); setUsedCredits(selected.used);
  }, []);
  const workspaceProfile: ElevenLabsWorkspaceProfile = { id: selectedWorkspaceId, label: workspaceLabel, workspaceLabel, enabled: true, keyReference: null, monthlyCreditBudget: creditBudget.trim() && Number.isFinite(Number(creditBudget)) && Number(creditBudget) >= 0 ? Number(creditBudget) : null, usedCredits: usedCredits.trim() && Number.isFinite(Number(usedCredits)) && Number(usedCredits) >= 0 ? Number(usedCredits) : null, voiceIds };
  const workspaceBudgetCheck = canScheduleWorkspaceJob(workspaceProfile, 0);
  const productionPlan = useMemo(() => buildVoiceProductionPlan(draftName, lines, voiceIds, {}, selectedWorkspaceId), [draftName, lines, voiceIds, selectedWorkspaceId]);
  const productionSummary = useMemo(() => voicePlanSummary(productionPlan), [productionPlan]);
  const exportProductionPlan = () => {
    if (!confirmed || sourceIsStale || (importedPlanWorkspaceId !== null && importedPlanWorkspaceId !== selectedWorkspaceId) || productionSummary.blocked) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(productionPlan, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "voice-production-queue.json"; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setPlanMessage("ส่งออกคิวเตรียมสร้างเสียงแล้ว ยังไม่มีการเรียก API หรือหักเครดิต");
  };
  const allSpeakers = useMemo(() => [...new Set(lines.filter(line => line.kind !== "sfx").map(line => line.speaker))], [lines]);
  return <section className="voiceStudioPanel" id="voice-studio">
    <header><div><p className="eyebrow">AI VOICE STUDIO · ขั้นเตรียมบท</p><h2>แยกบทนิยายและผู้พูด</h2><p className="muted">วางนิยายทั้งตอน ระบบจะแยกคำบรรยายและบทสนทนา พร้อมทำเครื่องหมายจุดที่ยังไม่ทราบผู้พูด ก่อนเชื่อมต่อระบบสร้างเสียง</p></div></header>
    <div className="voiceStudioActions"><label>ชื่อตอน <input value={draftName} onChange={event => { setDraftName(event.target.value); setConfirmed(false); }} /></label><label>เปิดแผนเสียงเดิม <input type="file" accept=".json,application/json" onChange={event => { void importPlan(event.target.files?.[0]); event.target.value = ""; }} /></label></div>
    <div className="voiceStudioGrid">
      <div><label htmlFor="voice-novel-input">ต้นฉบับนิยาย</label><textarea id="voice-novel-input" rows={12} aria-describedby="voice-script-character-count" value={script} onChange={event => { setScript(event.target.value); setConfirmed(false); }} placeholder={'สิงห์หยุดเดิน\n"หยุดก่อน" สิงห์กระซิบ\n[พูด: พรานอิน | อารมณ์: หวาดระแวง] ข้าได้ยินเสียง'} /><button className="primary" disabled={!script.trim() || scriptTooLong} onClick={() => { setLines(parseNovelScript(script)); setImportedPlanWorkspaceId(null); setAnalyzedSource(script); setFilter("all"); setConfirmed(false); }}>วิเคราะห์และแยกบท</button><p id="voice-script-character-count" role={scriptTooLong ? "alert" : undefined} className="muted">{script.length.toLocaleString()} / {MAX_SCRIPT_CHARACTERS.toLocaleString()} ตัวอักษร{scriptTooLong ? " — เกินขีดจำกัด กรุณาแบ่งต้นฉบับเป็นช่วงก่อนวิเคราะห์ (ระบบจะไม่ตัดข้อความอัตโนมัติ)" : ""}</p><p className="muted">กฎกำกับ: [บรรยาย | อารมณ์: ลึกลับ], [พูด: พรานสิง | อารมณ์: กระซิบ], [SFX: เสียงฝน] · คำกำกับไม่ถูกนำไปเป็นบทพูด</p></div>
      <div><strong>ผลการแยกบท</strong><p className="muted">{lines.length} ช่วง · {speakers.length} ผู้พูด · {reviewCount} จุดรอตรวจสอบ</p><div className="voiceStudioActions"><button onClick={() => setFilter("all")}>ทั้งหมด</button><button onClick={() => setFilter("review")}>รอตรวจสอบ ({reviewCount})</button></div><div className="voiceStudioLines">{lines.filter(line => filter === "all" || line.needsReview).map(line => <div key={line.id} className="voiceStudioLine"><span>{line.kind === "sfx" ? "เอฟเฟกต์" : line.kind === "narration" ? "บรรยาย" : "บทพูด"} {line.needsReview ? "⚠ ตรวจสอบผู้พูด" : ""}</span><textarea rows={2} value={line.text} onChange={event => patch(line.id, { text: event.target.value })}/>{line.kind !== "sfx" && <button onClick={() => previewLine(line)}>{previewLineId === line.id ? "กำลังอ่านตัวอย่าง..." : "ฟังตัวอย่างฟรี (เสียงเครื่อง)"}</button>}{line.kind === "dialogue" && <label>ผู้พูด <input value={line.speaker} onChange={event => patch(line.id, { speaker: event.target.value, needsReview: !event.target.value.trim() || event.target.value === "ไม่ทราบผู้พูด" })}/></label>}<label>อารมณ์ <input value={line.emotion} onChange={event => patch(line.id, { emotion: event.target.value })}/></label></div>)}</div></div>
    </div>
    {lines.length > 0 && <div className="voiceRegistry"><h3>จัดการชื่อผู้พูดทั้งตอน</h3><p className="muted">รวมชื่อที่ AI แยกต่างกัน เช่น สิงห์ และ พรานสิง โดยเปลี่ยนทุกบทพร้อมกัน</p><label>ชื่อเดิม<input value={findSpeaker} onChange={event => setFindSpeaker(event.target.value)} list="voice-speaker-names" placeholder="เช่น สิงห์" /></label><datalist id="voice-speaker-names">{speakers.map(name => <option key={name} value={name} />)}</datalist><label>ชื่อใหม่<input value={replaceSpeaker} onChange={event => setReplaceSpeaker(event.target.value)} placeholder="เช่น พรานสิง" /></label><button disabled={!findSpeaker.trim() || !replaceSpeaker.trim() || findSpeaker.trim() === replaceSpeaker.trim()} onClick={renameSpeaker}>เปลี่ยนชื่อทุกบท</button><h3>คลังเสียงประจำตัวละคร (Voice ID)</h3><button type="button" disabled={loadingVoices} onClick={() => void loadVoices()}>{loadingVoices ? "กำลังโหลดเสียง..." : "ดึงรายชื่อเสียงจาก ElevenLabs"}</button>{voiceLoadError && <p role="alert">{voiceLoadError}</p>}{availableVoices.length > 0 && <p className="muted">พบเสียง {availableVoices.length} รายการ เลือกเสียงให้แต่ละตัวละครได้เลย</p>}<p className="muted">กำหนด ElevenLabs Voice ID สำหรับแต่ละตัวละครและผู้บรรยาย ระบบยังไม่ส่งคำขอสร้างเสียง</p>{allSpeakers.map(speaker => <label key={speaker}>{speaker}<input aria-label={`Voice ID ของ ${speaker}`} value={voiceIds[speaker] ?? ""} onChange={event => { setConfirmed(false); setVoiceIds(previous => ({ ...previous, [speaker]: event.target.value })); }} placeholder="ElevenLabs Voice ID" />{availableVoices.length > 0 && <select aria-label={`เลือกเสียงให้ ${speaker}`} value={availableVoices.some(voice => voice.id === voiceIds[speaker]) ? voiceIds[speaker] : ""} onChange={event => { if (event.target.value) { setConfirmed(false); setVoiceIds(previous => ({ ...previous, [speaker]: event.target.value })); } }}><option value="">เลือกเสียงจากรายการ</option>{availableVoices.map(voice => <option key={voice.id} value={voice.id}>{voice.name}</option>)}</select>}</label>)}<p className="muted">จุดที่ต้องตรวจสอบ: ผู้พูดไม่ชัดเจน {reviewCount} ช่วง · ยังไม่กำหนด Voice ID {unresolvedVoiceCount} ช่วง</p></div>}
    {lines.length > 0 && <div className="voiceStudioActions"><button disabled={reviewCount > 0 || unresolvedVoiceCount > 0} onClick={() => setConfirmed(true)}>ยืนยันบทและเสียงทั้งหมด</button><button disabled={!confirmed || reviewCount > 0 || unresolvedVoiceCount > 0} onClick={exportPlan}>ส่งออกแผนเสียง JSON</button><span>{confirmed ? "✓ ตรวจบทแล้ว พร้อมส่งออก" : "ต้องตรวจผู้พูดและ Voice ID ก่อนยืนยัน"}</span></div>}
    {lines.length > 0 && <div className="voiceRegistry"><h3>Workspace และงบเครดิต (เตรียมระบบ)</h3><label>เลือก Workspace<select value={selectedWorkspaceId} onChange={event => { const profile = workspaceProfiles.find(item => item.id === event.target.value); if (!profile) return; setSelectedWorkspaceId(profile.id); setVoiceIds(readWorkspaceVoices(profile.id)); setWorkspaceLabel(profile.label); setCreditBudget(profile.budget); setUsedCredits(profile.used); setConfirmed(false); }}>{workspaceProfiles.map(profile => <option key={profile.id} value={profile.id}>{profile.label}</option>)}</select></label><button onClick={() => { const id = `workspace-${Date.now()}`; const profile = { id, label: `Workspace ${workspaceProfiles.length + 1}`, budget: "", used: "" }; setWorkspaceProfiles(previous => [...previous, profile]); setSelectedWorkspaceId(id); setVoiceIds({}); setWorkspaceLabel(profile.label); setCreditBudget(""); setUsedCredits(""); setConfirmed(false); }}>เพิ่มโปรไฟล์ Workspace (ไม่มี API Key)</button><button disabled={workspaceProfiles.length <= 1} onClick={() => { const remaining = workspaceProfiles.filter(item => item.id !== selectedWorkspaceId); setWorkspaceProfiles(remaining); const next = remaining[0]; setSelectedWorkspaceId(next.id); setVoiceIds(readWorkspaceVoices(next.id)); setWorkspaceLabel(next.label); setCreditBudget(next.budget); setUsedCredits(next.used); setConfirmed(false); }}>ลบโปรไฟล์ที่เลือก</button><button onClick={() => { setWorkspaceProfiles(previous => previous.map(item => item.id === selectedWorkspaceId ? { ...item, label: workspaceLabel, budget: creditBudget, used: usedCredits } : item)); setPlanMessage("บันทึกข้อมูลโปรไฟล์ลงเครื่องแล้ว (ไม่รวม API Key)"); }}>บันทึกข้อมูลโปรไฟล์ในหน้านี้</button><label>ชื่อ Workspace<input value={workspaceLabel} onChange={event => setWorkspaceLabel(event.target.value)} /></label><label>เพดานเครดิตที่ตั้งไว้<input inputMode="numeric" value={creditBudget} onChange={event => setCreditBudget(event.target.value)} /></label><label>เครดิตที่ใช้ไป (กรอกเอง)<input inputMode="numeric" value={usedCredits} onChange={event => setUsedCredits(event.target.value)} placeholder="ยังไม่ทราบ" /></label><p className="muted">{workspaceBudgetCheck.allowed ? "ข้อมูลเพดานและยอดใช้งานพร้อมสำหรับตรวจสอบเบื้องต้น" : workspaceBudgetCheck.reason} · ยังไม่เชื่อม API ตรวจยอดจริง และยังไม่ใช้ตัวเลขนี้อนุมัติการสร้างเสียง</p></div>}
    {importedPlanWorkspaceId !== null && importedPlanWorkspaceId !== selectedWorkspaceId && <p role="alert">แผนเสียงที่นำเข้ามาจาก Workspace อื่น กรุณาเลือก Workspace ให้ตรงกับไฟล์และนำเข้าใหม่ก่อนส่งออกคิว</p>}
    {sourceIsStale && <p role="alert">ต้นฉบับถูกแก้ไขหลังวิเคราะห์ กรุณากดวิเคราะห์และแยกบทอีกครั้งก่อนส่งออกคิวเสียง</p>}
    {lines.length > 0 && <div className="voiceRegistry"><h3>คิวเตรียมสร้างเสียง (ออฟไลน์)</h3><p className="muted">พร้อมสร้าง {productionSummary.ready} บรรทัด · ต้องแก้ไข {productionSummary.blocked} บรรทัด · SFX {productionSummary.sfx} จุด · ประมาณ {productionSummary.estimatedCharacters.toLocaleString()} ตัวอักษรที่รอส่ง ElevenLabs</p><button disabled={!confirmed || sourceIsStale || (importedPlanWorkspaceId !== null && importedPlanWorkspaceId !== selectedWorkspaceId) || productionSummary.blocked > 0} onClick={exportProductionPlan}>ส่งออกคิวสร้างเสียง JSON (ไม่เรียก API)</button><p className="muted">ระบบยังไม่เริ่มสร้างเสียงและไม่หักเครดิต คิวนี้เป็นเพียงข้อมูลสำหรับเชื่อมระบบภายหลัง</p></div>}
    {planMessage && <p role="status" className="muted">{planMessage}</p>}
    <p className="muted">การฟังตัวอย่างใช้เสียงสังเคราะห์ของระบบปฏิบัติการ ไม่ใช่เสียง ElevenLabs และอาจไม่รองรับภาษาไทยบนบางเครื่อง</p>
    <p className="muted">ขั้นนี้เป็นการแยกบทด้วยกฎและตรวจทานด้วยคน ยังไม่เรียก AI วิเคราะห์บริบทเชิงลึกหรือ ElevenLabs และยังไม่คิดเครดิตสร้างเสียง</p>
  </section>;
}
