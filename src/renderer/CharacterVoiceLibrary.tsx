import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "voice-studio-global-character-voices-v1";
export function readCharacterVoiceLibrary(): Record<string, string> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([name, id]) => name.trim().length > 0 && name.length <= 150 && typeof id === "string" && id.length <= 250)) as Record<string, string>;
  } catch { return {}; }
}
export default function CharacterVoiceLibrary({ projectId }: { projectId?: string | null }) {
  const voiceDataRevision = useRef(0);
  const saveInFlight = useRef(false);
  const currentProjectId = useRef(projectId);
  currentProjectId.current = projectId;
  const [projectLoading, setProjectLoading] = useState(false);
  const [readyProjectId, setReadyProjectId] = useState<string | null | undefined>(undefined);
  const projectReady = readyProjectId !== undefined && readyProjectId === projectId;
  const [projectVersion, setProjectVersion] = useState(0);
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
    let active = true;
    const loadRevision = ++voiceDataRevision.current;
    setReadyProjectId(undefined);
    setProjectLoading(Boolean(projectId));
    setSelectedCharacter(null);
    setConfirmDelete(null);
    setName("");
    setVoiceId("");
    setEditId("");
    setShowAdd(false);
    stopPreview();
    setMessage("");
    if (!projectId) {
      setEntries(readCharacterVoiceLibrary());
      setProjectLoading(false);
      setReadyProjectId(projectId);
      return () => { active = false; };
    }
    void window.videoEditor.loadStudioCharacterVoices(projectId).then(loaded => {
      if (!active || voiceDataRevision.current !== loadRevision) return;
      setEntries(loaded);
      setReadyProjectId(projectId);
    }).catch(error => {
      if (active && voiceDataRevision.current === loadRevision && currentProjectId.current === projectId) setMessage("โหลดคลังเสียงโปรเจกต์ไม่สำเร็จ: " + String(error));
    }).finally(() => { if (active && voiceDataRevision.current === loadRevision && currentProjectId.current === projectId) setProjectLoading(false); });
    return () => { active = false; };
  }, [projectId, projectVersion]);
  useEffect(() => {
    if (!projectId) return;
    let active = true;
    let revision = 0;
    const refresh = () => {
      const request = ++revision;
      const loadRevision = ++voiceDataRevision.current;
      void window.videoEditor.loadStudioCharacterVoices(projectId).then(latest => {
        if (!active || request !== revision || currentProjectId.current !== projectId || voiceDataRevision.current !== loadRevision) return;
        setEntries(latest);
        setReadyProjectId(projectId);
        setProjectLoading(false);
      }).catch(error => {
        if (active && request === revision && currentProjectId.current === projectId && voiceDataRevision.current === loadRevision) {
          setProjectLoading(false);
          setMessage("รีเฟรชคลังเสียงไม่สำเร็จ: " + String(error));
        }
      });
    };
    window.addEventListener("character-voices-updated", refresh);
    return () => {
      active = false;
      revision++;
      window.removeEventListener("character-voices-updated", refresh);
    };
  }, [projectId]);
  const updateEntries = async (nextInput: Record<string, string>) => {
    let next = nextInput;
    if (!projectReady || projectLoading || saveInFlight.current) return false;
    saveInFlight.current = true;
    const saveRevision = ++voiceDataRevision.current;
    setProjectLoading(true);
    try {
      if (projectId) {
        const changes = Object.entries(next).filter(([character, id]) => entries[character] !== id);
        const removed = Object.keys(entries).filter(character => !(character in next));
        for (const [character, id] of changes) {
          next = await window.videoEditor.patchStudioCharacterVoice(projectId, character, id);
        }
        for (const character of removed) {
          next = await window.videoEditor.patchStudioCharacterVoice(projectId, character, null);
        }
      } else localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      if (currentProjectId.current === projectId && voiceDataRevision.current === saveRevision) {
        setEntries(next);
        window.dispatchEvent(new Event("character-voices-updated"));
      }
      return currentProjectId.current === projectId && voiceDataRevision.current === saveRevision;
    } catch (error) {
      if (currentProjectId.current === projectId && voiceDataRevision.current === saveRevision) setMessage("บันทึกคลังเสียงไม่สำเร็จ: " + String(error));
      return false;
    } finally { saveInFlight.current = false; if (currentProjectId.current === projectId && voiceDataRevision.current === saveRevision) setProjectLoading(false); }
  };
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
    if (!projectReady || projectLoading) { setMessage("กรุณารอให้คลังเสียงพร้อมก่อนบันทึก"); return; }
    void updateEntries({ ...entries, [character]: id }).then(saved => {
      if (!saved || currentProjectId.current !== projectId) return;
      setName(""); setVoiceId(""); setShowAdd(false);
      setMessage("บันทึกเสียงประจำตัวละครแล้ว กด ＋ เพิ่มตัวละครใหม่ เพื่อเพิ่มคนถัดไป");
    });
  };
  return <section className="voiceStudioPanel premiumVoicePanel" id="character-voice-library" aria-label="คลังเสียงตัวละคร">
    <div className="premiumHeading"><div><p className="eyebrow">CHARACTER VOICE LIBRARY</p><h2>🎙️ คลังเสียงตัวละครถาวร</h2></div></div>
    <p className="muted">{projectId ? "คลังเสียงเฉพาะโปรเจกต์นี้ ไม่ปะปนกับเรื่องอื่น" : "คลังเสียงส่วนกลางเดิมของเครื่อง (ไม่ถูกลบหรือย้ายอัตโนมัติ)"}</p>
    {projectLoading && <p role="status">กำลังอ่านหรือบันทึกคลังเสียง...</p>}
    {projectId && !projectReady && !projectLoading && <button type="button" onClick={() => setProjectVersion(value => value + 1)}>โหลดคลังเสียงอีกครั้ง</button>}
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
      <button type="button" onClick={add} disabled={!projectReady || projectLoading || !name.trim() || !voiceId.trim()}>＋ บันทึกและเพิ่มตัวละคร</button>
    </div>}
    {message && <p role="status">{message}</p>}
    {Object.keys(entries).length === 0 ? <p className="muted">ยังไม่มีเสียงตัวละครที่บันทึกไว้</p> : <div className="voiceRegistry"><h3>เสียงที่บันทึกแล้ว ({Object.keys(entries).length})</h3><div className="premiumCharacterGrid compactCharacterGrid">{Object.entries(entries).sort(([a], [b]) => a.localeCompare(b, "th")).map(([character, id]) => <article className={`premiumCharacterCard compactCharacterCard ${selectedCharacter === character ? "isSelected" : ""}`} key={character}>
      <button type="button" className="compactCharacterFace" aria-expanded={selectedCharacter === character} onClick={() => { setSelectedCharacter(previous => previous === character ? null : character); setEditId(id); setConfirmDelete(null); }}>
        <span className="premiumCharacterAvatar" aria-hidden="true">{character.slice(0, 1)}</span><strong className="premiumCharacterName">{character}</strong><span className="compactCharacterChevron">{selectedCharacter === character ? "⌃" : "⌄"}</span>
      </button>
      {selectedCharacter === character && <div className="compactCharacterDetails">
        <p className="muted">Voice ID ถูกซ่อนไว้เพื่อป้องกันการแก้ไขโดยไม่ตั้งใจ</p>
        <div className="voiceStudioActions"><button type="button" onClick={() => { setEditId(id); setConfirmDelete(null); setSelectedCharacter(character + "::edit"); }}>แก้ไข Voice ID</button><button type="button" className="premiumRemoveButton" onClick={() => setConfirmDelete(character)}>ลบเสียงนี้</button></div>
        {confirmDelete === character && <div className="voiceStudioActions"><strong>ยืนยันลบเสียง {character}?</strong><button type="button" onClick={() => { void updateEntries(Object.fromEntries(Object.entries(entries).filter(([key]) => key !== character))).then(saved => { if (saved && currentProjectId.current === projectId) { setSelectedCharacter(null); setConfirmDelete(null); } }); }}>ยืนยันลบ</button><button type="button" onClick={() => setConfirmDelete(null)}>ยกเลิก</button></div>}
      </div>}
      {selectedCharacter === character + "::edit" && <div className="compactCharacterDetails"><label>แก้ไข Voice ID <input value={editId} onChange={event => setEditId(event.target.value)} /></label><div className="voiceStudioActions"><button type="button" disabled={!editId.trim()} onClick={() => { void updateEntries({...entries,[character]:editId.trim()}).then(saved => { if (saved && currentProjectId.current === projectId) setSelectedCharacter(character); }); }}>บันทึกการแก้ไข</button><button type="button" onClick={() => setSelectedCharacter(character)}>ยกเลิก</button></div></div>}
    </article>)}</div></div>}
  </section>;
}
