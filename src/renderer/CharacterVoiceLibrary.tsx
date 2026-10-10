import { useEffect, useRef, useState } from "react";

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
  const [voices, setVoices] = useState<Array<{ id: string; name: string; previewUrl: string | null }>>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  const [editId, setEditId] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const previewAudio = useRef<HTMLAudioElement | null>(null);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const stopPreview = () => { previewAudio.current?.pause(); previewAudio.current = null; setPlayingVoiceId(null); };
  useEffect(() => () => { previewAudio.current?.pause(); }, []);
  const playPreview = (id: string) => {
    if (playingVoiceId === id) { stopPreview(); return; }
    stopPreview();
    const previewUrl = voices.find(item => item.id === id)?.previewUrl;
    if (!previewUrl) { setMessage("เสียงนี้ไม่มีตัวอย่างจาก ElevenLabs"); return; }
    const audio = new Audio(previewUrl);
    previewAudio.current = audio; setPlayingVoiceId(id); setMessage("");
    audio.onended = () => { if (previewAudio.current === audio) stopPreview(); };
    audio.onerror = () => { if (previewAudio.current === audio) { stopPreview(); setMessage("เปิดเสียงตัวอย่างไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ต"); } };
    void audio.play().catch(() => { if (previewAudio.current === audio) { stopPreview(); setMessage("ไม่สามารถเล่นเสียงตัวอย่างนี้ได้"); } });
  };
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); window.dispatchEvent(new Event("character-voices-updated")); }
    catch { setMessage("บันทึกคลังเสียงในเครื่องไม่สำเร็จ"); }
  }, [entries]);
  const loadVoices = async () => {
    stopPreview(); setLoading(true); setMessage("");
    try { setVoices(await window.videoEditor.listElevenLabsVoices()); }
    catch { setMessage("ดึงรายชื่อเสียงไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อ ElevenLabs และสิทธิ์ Voices: Read"); }
    finally { setLoading(false); }
  };
  const add = () => {
    const character = name.trim();
    const id = voiceId.trim();
    if (!character || !id || character.length > 150 || id.length > 250) { setMessage("กรุณากรอกชื่อตัวละครและ Voice ID ให้ถูกต้อง"); return; }
    setEntries(previous => ({ ...previous, [character]: id }));
    setName(""); setVoiceId(""); setShowAdd(false); setMessage("บันทึกเสียงประจำตัวละครแล้ว กด ＋ เพิ่มตัวละครใหม่ เพื่อเพิ่มคนถัดไป");
  };
  return <section className="voiceStudioPanel premiumVoicePanel" id="character-voice-library" aria-label="คลังเสียงตัวละคร">
    <div className="premiumHeading"><div><p className="eyebrow">CHARACTER VOICE LIBRARY</p><h2>🎙️ คลังเสียงตัวละครถาวร</h2></div></div>
    <p className="muted">กำหนดเสียงครั้งเดียวเพื่อใช้กับบททุกตอนในเครื่องนี้ ไม่ต้องแยกบทก่อน สามารถแก้ไขหรือเปลี่ยนเสียงภายหลังได้</p>
    <div className="voiceStudioActions">
      <button type="button" onClick={() => { setShowAdd(previous => !previous); setMessage(""); }}>{showAdd ? "ยกเลิก" : "＋ เพิ่มตัวละครใหม่"}</button>
      <strong>บันทึกแล้ว {Object.keys(entries).length} ตัวละคร</strong>
    </div>
    {showAdd && <div className="voiceStudioActions">
      <label>ชื่อตัวละคร <input value={name} onChange={event => setName(event.target.value)} placeholder="เช่น พรานสิง" /></label>
      <label>Voice ID <input value={voiceId} onChange={event => setVoiceId(event.target.value)} placeholder="วาง Voice ID จาก ElevenLabs" /></label>
      <button type="button" disabled={loading} onClick={() => void loadVoices()}>{loading ? "กำลังโหลด..." : "ดึงเสียงจาก ElevenLabs"}</button>
      {voices.length > 0 && <label>เลือกเสียง <select value={voices.some(item => item.id === voiceId) ? voiceId : ""} onChange={event => setVoiceId(event.target.value)}><option value="">เลือกเสียง</option>{voices.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      {voiceId && voices.some(item => item.id === voiceId) && <button type="button" disabled={!voices.find(item => item.id === voiceId)?.previewUrl} onClick={() => playPreview(voiceId)}>{playingVoiceId === voiceId ? "■ หยุดฟัง" : voices.find(item => item.id === voiceId)?.previewUrl ? "▶ ฟังเสียงตัวอย่าง" : "ไม่มีเสียงตัวอย่าง"}</button>}
      <button type="button" onClick={add} disabled={!name.trim() || !voiceId.trim()}>＋ บันทึกและเพิ่มตัวละคร</button>
    </div>}
    {message && <p role="status">{message}</p>}
    {Object.keys(entries).length === 0 ? <p className="muted">ยังไม่มีเสียงตัวละครที่บันทึกไว้</p> : <div className="voiceRegistry"><h3>เสียงที่บันทึกแล้ว ({Object.keys(entries).length})</h3><div className="premiumCharacterGrid compactCharacterGrid">{Object.entries(entries).sort(([a], [b]) => a.localeCompare(b, "th")).map(([character, id]) => <article className={`premiumCharacterCard compactCharacterCard ${selectedCharacter === character ? "isSelected" : ""}`} key={character}>
      <button type="button" className="compactCharacterFace" aria-expanded={selectedCharacter === character} onClick={() => { setSelectedCharacter(previous => previous === character ? null : character); setEditId(id); setConfirmDelete(null); }}>
        <span className="premiumCharacterAvatar" aria-hidden="true">{character.slice(0, 1)}</span><strong className="premiumCharacterName">{character}</strong><span className="compactCharacterChevron">{selectedCharacter === character ? "⌃" : "⌄"}</span>
      </button>
      {selectedCharacter === character && <div className="compactCharacterDetails">
        <p className="muted">Voice ID ถูกซ่อนไว้เพื่อป้องกันการแก้ไขโดยไม่ตั้งใจ</p>
        <div className="voiceStudioActions"><button type="button" onClick={() => { setEditId(id); setConfirmDelete(null); setSelectedCharacter(character + "::edit"); }}>แก้ไข Voice ID</button><button type="button" className="premiumRemoveButton" onClick={() => setConfirmDelete(character)}>ลบเสียงนี้</button></div>
        {confirmDelete === character && <div className="voiceStudioActions"><strong>ยืนยันลบเสียง {character}?</strong><button type="button" onClick={() => { setEntries(previous => { const next = { ...previous }; delete next[character]; return next; }); setSelectedCharacter(null); setConfirmDelete(null); }}>ยืนยันลบ</button><button type="button" onClick={() => setConfirmDelete(null)}>ยกเลิก</button></div>}
      </div>}
      {selectedCharacter === character + "::edit" && <div className="compactCharacterDetails"><label>แก้ไข Voice ID <input value={editId} onChange={event => setEditId(event.target.value)} /></label><div className="voiceStudioActions"><button type="button" disabled={!editId.trim()} onClick={() => { setEntries(previous => ({...previous,[character]:editId.trim()})); setSelectedCharacter(character); }}>บันทึกการแก้ไข</button><button type="button" onClick={() => setSelectedCharacter(character)}>ยกเลิก</button></div></div>}
    </article>)}</div></div>}
  </section>;
}
