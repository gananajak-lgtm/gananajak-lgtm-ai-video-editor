import { useEffect, useState } from "react";

const STORAGE_KEY = "voice-studio-global-character-voices-v1";
export function readCharacterVoiceLibrary(): Record<string, string> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([name, id]) => name.trim().length > 0 && name.length <= 150 && typeof id === "string" && id.length <= 250)) as Record<string, string>;
  } catch { return {}; }
}
export default function CharacterVoiceLibrary() {
  const [entries, setEntries] = useState<Record<string, string>>(readCharacterVoiceLibrary);
  const [name, setName] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [voices, setVoices] = useState<Array<{ id: string; name: string }>>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); window.dispatchEvent(new Event("character-voices-updated")); }
    catch { setMessage("บันทึกคลังเสียงในเครื่องไม่สำเร็จ"); }
  }, [entries]);
  const loadVoices = async () => {
    setLoading(true); setMessage("");
    try { setVoices(await window.videoEditor.listElevenLabsVoices()); }
    catch { setMessage("ดึงรายชื่อเสียงไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อ ElevenLabs และสิทธิ์ Voices: Read"); }
    finally { setLoading(false); }
  };
  const add = () => {
    const character = name.trim();
    const id = voiceId.trim();
    if (!character || !id || character.length > 150 || id.length > 250) { setMessage("กรุณากรอกชื่อตัวละครและ Voice ID ให้ถูกต้อง"); return; }
    setEntries(previous => ({ ...previous, [character]: id }));
    setName(""); setVoiceId(""); setMessage("บันทึกเสียงประจำตัวละครแล้ว");
  };
  return <section className="voiceStudioPanel" id="character-voice-library" aria-label="คลังเสียงตัวละคร">
    <h2>🎙️ คลังเสียงตัวละครถาวร</h2>
    <p className="muted">กำหนดเสียงครั้งเดียวเพื่อใช้กับบททุกตอนในเครื่องนี้ ไม่ต้องแยกบทก่อน สามารถแก้ไขหรือเปลี่ยนเสียงภายหลังได้</p>
    <div className="voiceStudioActions">
      <label>ชื่อตัวละคร <input value={name} onChange={event => setName(event.target.value)} placeholder="เช่น พรานสิง" /></label>
      <label>Voice ID <input value={voiceId} onChange={event => setVoiceId(event.target.value)} placeholder="วาง Voice ID จาก ElevenLabs" /></label>
      <button type="button" disabled={loading} onClick={() => void loadVoices()}>{loading ? "กำลังโหลด..." : "ดึงเสียงจาก ElevenLabs"}</button>
      {voices.length > 0 && <label>เลือกเสียง <select value={voices.some(item => item.id === voiceId) ? voiceId : ""} onChange={event => setVoiceId(event.target.value)}><option value="">เลือกเสียง</option>{voices.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      <button type="button" onClick={add} disabled={!name.trim() || !voiceId.trim()}>บันทึกตัวละคร</button>
    </div>
    {message && <p role="status">{message}</p>}
    {Object.keys(entries).length === 0 ? <p className="muted">ยังไม่มีเสียงตัวละครที่บันทึกไว้</p> : <div className="voiceRegistry"><h3>เสียงที่บันทึกแล้ว ({Object.keys(entries).length})</h3>{Object.entries(entries).sort(([a], [b]) => a.localeCompare(b, "th")).map(([character, id]) => <div className="voiceStudioActions" key={character}><strong>{character}</strong><input aria-label={`Voice ID ของ ${character}`} value={id} onChange={event => setEntries(previous => ({ ...previous, [character]: event.target.value }))}/><button type="button" onClick={() => { setEntries(previous => { const next = { ...previous }; delete next[character]; return next; }); }}>ลบ</button></div>)}</div>}
  </section>;
}
