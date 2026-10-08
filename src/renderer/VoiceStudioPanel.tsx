import { useMemo, useState } from "react";
import { parseNovelScript } from "./novel-voice-parser";
import type { VoiceLine } from "./novel-voice-parser";

export default function VoiceStudioPanel() {
  const [script, setScript] = useState("");
  const [lines, setLines] = useState<VoiceLine[]>([]);
  const [filter, setFilter] = useState<"all" | "review">("all");
  const speakers = useMemo(() => [...new Set(lines.filter(line => line.kind === "dialogue").map(line => line.speaker))], [lines]);
  const reviewCount = lines.filter(line => line.needsReview).length;
  const patch = (id: string, change: Partial<VoiceLine>) => setLines(previous => previous.map(line => line.id === id ? { ...line, ...change } : line));
  return <section className="voiceStudioPanel" id="voice-studio">
    <header><div><p className="eyebrow">AI VOICE STUDIO · ขั้นเตรียมบท</p><h2>แยกบทนิยายและผู้พูด</h2><p className="muted">วางนิยายทั้งตอน ระบบจะแยกคำบรรยายและบทสนทนา พร้อมทำเครื่องหมายจุดที่ยังไม่ทราบผู้พูด ก่อนเชื่อมต่อระบบสร้างเสียง</p></div></header>
    <div className="voiceStudioGrid">
      <div><label htmlFor="voice-novel-input">ต้นฉบับนิยาย</label><textarea id="voice-novel-input" rows={12} value={script} onChange={event => setScript(event.target.value)} placeholder={'สิงห์หยุดเดิน\n"หยุดก่อน" สิงห์กระซิบ\n[พูด: พรานอิน | อารมณ์: หวาดระแวง] ข้าได้ยินเสียง'} /><button className="primary" disabled={!script.trim()} onClick={() => { setLines(parseNovelScript(script)); setFilter("all"); }}>วิเคราะห์และแยกบท</button><p className="muted">กฎกำกับ: [บรรยาย | อารมณ์: ลึกลับ], [พูด: พรานสิง | อารมณ์: กระซิบ], [SFX: เสียงฝน] · คำกำกับไม่ถูกนำไปเป็นบทพูด</p></div>
      <div><strong>ผลการแยกบท</strong><p className="muted">{lines.length} ช่วง · {speakers.length} ผู้พูด · {reviewCount} จุดรอตรวจสอบ</p><div className="voiceStudioActions"><button onClick={() => setFilter("all")}>ทั้งหมด</button><button onClick={() => setFilter("review")}>รอตรวจสอบ ({reviewCount})</button></div><div className="voiceStudioLines">{lines.filter(line => filter === "all" || line.needsReview).map(line => <div key={line.id} className="voiceStudioLine"><span>{line.kind === "sfx" ? "เอฟเฟกต์" : line.kind === "narration" ? "บรรยาย" : "บทพูด"} {line.needsReview ? "⚠ ตรวจสอบผู้พูด" : ""}</span><textarea rows={2} value={line.text} onChange={event => patch(line.id, { text: event.target.value })}/>{line.kind === "dialogue" && <label>ผู้พูด <input value={line.speaker} onChange={event => patch(line.id, { speaker: event.target.value, needsReview: !event.target.value.trim() || event.target.value === "ไม่ทราบผู้พูด" })}/></label>}<label>อารมณ์ <input value={line.emotion} onChange={event => patch(line.id, { emotion: event.target.value })}/></label></div>)}</div></div>
    </div>
    <p className="muted">ขั้นนี้เป็นการแยกบทด้วยกฎและตรวจทานด้วยคน ยังไม่เรียก AI วิเคราะห์บริบทเชิงลึกหรือ ElevenLabs และยังไม่คิดเครดิตสร้างเสียง</p>
  </section>;
}
