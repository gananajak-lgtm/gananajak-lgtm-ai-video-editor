import { useEffect, useMemo, useState } from "react";
import { parseNovelScript } from "./novel-voice-parser";
import type { VoiceLine } from "./novel-voice-parser";

export default function VoiceStudioPanel() {
  const [script, setScript] = useState("");
  const [lines, setLines] = useState<VoiceLine[]>([]);
  const [filter, setFilter] = useState<"all" | "review">("all");
  const [voiceIds, setVoiceIds] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem("voice-studio-voice-map-v1") || "{}") as Record<string, string>; }
    catch { return {}; }
  });
  useEffect(() => { localStorage.setItem("voice-studio-voice-map-v1", JSON.stringify(voiceIds)); }, [voiceIds]);
  const [confirmed, setConfirmed] = useState(false);
  const [findSpeaker, setFindSpeaker] = useState("");
  const [replaceSpeaker, setReplaceSpeaker] = useState("");
  const [planMessage, setPlanMessage] = useState("");
  const [draftName, setDraftName] = useState("ตอนที่ 1");
  const [previewLineId, setPreviewLineId] = useState<string | null>(null);
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
      const plan = data as { schemaVersion?: unknown; lines?: unknown; voiceIds?: unknown; title?: unknown };
      if (plan.schemaVersion !== 1 || !Array.isArray(plan.lines) || plan.lines.length > 10000) throw new Error("เวอร์ชันหรือรายการบทไม่ถูกต้อง");
      const valid = plan.lines.every((line: unknown) => { const x = line as VoiceLine; return x && typeof x.id === "string" && typeof x.text === "string" && typeof x.speaker === "string" && typeof x.emotion === "string" && ["narration", "dialogue", "sfx"].includes(x.kind) && typeof x.needsReview === "boolean"; });
      if (!valid) throw new Error("พบข้อมูลบทพูดไม่ถูกต้อง");
      const map: Record<string, string> = {};
      if (plan.voiceIds && typeof plan.voiceIds === "object" && !Array.isArray(plan.voiceIds)) for (const [key, value] of Object.entries(plan.voiceIds)) if (typeof value === "string") map[key] = value;
      setLines(plan.lines as VoiceLine[]); setVoiceIds(map);
      if (typeof plan.title === "string") setDraftName(plan.title.slice(0, 120));
      setConfirmed(false); setFilter("all"); setPlanMessage("นำเข้าแผนเสียงแล้ว กรุณาตรวจสอบและยืนยันใหม่");
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
    const plan = { schemaVersion: 1, title: draftName, createdAt: new Date().toISOString(), lines, voiceIds };
    const url = URL.createObjectURL(new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "voice-studio-plan.json"; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setPlanMessage("ส่งออกแผนเสียงแล้ว โปรดเก็บไฟล์ JSON ไว้สำหรับขั้นตอนสร้างเสียง");
  };
  const allSpeakers = useMemo(() => [...new Set(lines.filter(line => line.kind !== "sfx").map(line => line.speaker))], [lines]);
  return <section className="voiceStudioPanel" id="voice-studio">
    <header><div><p className="eyebrow">AI VOICE STUDIO · ขั้นเตรียมบท</p><h2>แยกบทนิยายและผู้พูด</h2><p className="muted">วางนิยายทั้งตอน ระบบจะแยกคำบรรยายและบทสนทนา พร้อมทำเครื่องหมายจุดที่ยังไม่ทราบผู้พูด ก่อนเชื่อมต่อระบบสร้างเสียง</p></div></header>
    <div className="voiceStudioActions"><label>ชื่อตอน <input value={draftName} onChange={event => { setDraftName(event.target.value); setConfirmed(false); }} /></label><label>เปิดแผนเสียงเดิม <input type="file" accept=".json,application/json" onChange={event => { void importPlan(event.target.files?.[0]); event.target.value = ""; }} /></label></div>
    <div className="voiceStudioGrid">
      <div><label htmlFor="voice-novel-input">ต้นฉบับนิยาย</label><textarea id="voice-novel-input" rows={12} value={script} onChange={event => setScript(event.target.value)} placeholder={'สิงห์หยุดเดิน\n"หยุดก่อน" สิงห์กระซิบ\n[พูด: พรานอิน | อารมณ์: หวาดระแวง] ข้าได้ยินเสียง'} /><button className="primary" disabled={!script.trim()} onClick={() => { setLines(parseNovelScript(script)); setFilter("all"); setConfirmed(false); }}>วิเคราะห์และแยกบท</button><p className="muted">กฎกำกับ: [บรรยาย | อารมณ์: ลึกลับ], [พูด: พรานสิง | อารมณ์: กระซิบ], [SFX: เสียงฝน] · คำกำกับไม่ถูกนำไปเป็นบทพูด</p></div>
      <div><strong>ผลการแยกบท</strong><p className="muted">{lines.length} ช่วง · {speakers.length} ผู้พูด · {reviewCount} จุดรอตรวจสอบ</p><div className="voiceStudioActions"><button onClick={() => setFilter("all")}>ทั้งหมด</button><button onClick={() => setFilter("review")}>รอตรวจสอบ ({reviewCount})</button></div><div className="voiceStudioLines">{lines.filter(line => filter === "all" || line.needsReview).map(line => <div key={line.id} className="voiceStudioLine"><span>{line.kind === "sfx" ? "เอฟเฟกต์" : line.kind === "narration" ? "บรรยาย" : "บทพูด"} {line.needsReview ? "⚠ ตรวจสอบผู้พูด" : ""}</span><textarea rows={2} value={line.text} onChange={event => patch(line.id, { text: event.target.value })}/>{line.kind !== "sfx" && <button onClick={() => previewLine(line)}>{previewLineId === line.id ? "กำลังอ่านตัวอย่าง..." : "ฟังตัวอย่างฟรี (เสียงเครื่อง)"}</button>}{line.kind === "dialogue" && <label>ผู้พูด <input value={line.speaker} onChange={event => patch(line.id, { speaker: event.target.value, needsReview: !event.target.value.trim() || event.target.value === "ไม่ทราบผู้พูด" })}/></label>}<label>อารมณ์ <input value={line.emotion} onChange={event => patch(line.id, { emotion: event.target.value })}/></label></div>)}</div></div>
    </div>
    {lines.length > 0 && <div className="voiceRegistry"><h3>จัดการชื่อผู้พูดทั้งตอน</h3><p className="muted">รวมชื่อที่ AI แยกต่างกัน เช่น สิงห์ และ พรานสิง โดยเปลี่ยนทุกบทพร้อมกัน</p><label>ชื่อเดิม<input value={findSpeaker} onChange={event => setFindSpeaker(event.target.value)} list="voice-speaker-names" placeholder="เช่น สิงห์" /></label><datalist id="voice-speaker-names">{speakers.map(name => <option key={name} value={name} />)}</datalist><label>ชื่อใหม่<input value={replaceSpeaker} onChange={event => setReplaceSpeaker(event.target.value)} placeholder="เช่น พรานสิง" /></label><button disabled={!findSpeaker.trim() || !replaceSpeaker.trim() || findSpeaker.trim() === replaceSpeaker.trim()} onClick={renameSpeaker}>เปลี่ยนชื่อทุกบท</button><h3>คลังเสียงประจำตัวละคร (Voice ID)</h3><p className="muted">กำหนด ElevenLabs Voice ID สำหรับแต่ละตัวละครและผู้บรรยาย ระบบยังไม่ส่งคำขอสร้างเสียง</p>{allSpeakers.map(speaker => <label key={speaker}>{speaker}<input aria-label={`Voice ID ของ ${speaker}`} value={voiceIds[speaker] ?? ""} onChange={event => { setConfirmed(false); setVoiceIds(previous => ({ ...previous, [speaker]: event.target.value })); }} placeholder="ElevenLabs Voice ID" /></label>)}<p className="muted">จุดที่ต้องตรวจสอบ: ผู้พูดไม่ชัดเจน {reviewCount} ช่วง · ยังไม่กำหนด Voice ID {unresolvedVoiceCount} ช่วง</p></div>}
    {lines.length > 0 && <div className="voiceStudioActions"><button disabled={reviewCount > 0 || unresolvedVoiceCount > 0} onClick={() => setConfirmed(true)}>ยืนยันบทและเสียงทั้งหมด</button><button disabled={!confirmed || reviewCount > 0 || unresolvedVoiceCount > 0} onClick={exportPlan}>ส่งออกแผนเสียง JSON</button><span>{confirmed ? "✓ ตรวจบทแล้ว พร้อมส่งออก" : "ต้องตรวจผู้พูดและ Voice ID ก่อนยืนยัน"}</span></div>}
    {planMessage && <p role="status" className="muted">{planMessage}</p>}
    <p className="muted">การฟังตัวอย่างใช้เสียงสังเคราะห์ของระบบปฏิบัติการ ไม่ใช่เสียง ElevenLabs และอาจไม่รองรับภาษาไทยบนบางเครื่อง</p>
    <p className="muted">ขั้นนี้เป็นการแยกบทด้วยกฎและตรวจทานด้วยคน ยังไม่เรียก AI วิเคราะห์บริบทเชิงลึกหรือ ElevenLabs และยังไม่คิดเครดิตสร้างเสียง</p>
  </section>;
}
