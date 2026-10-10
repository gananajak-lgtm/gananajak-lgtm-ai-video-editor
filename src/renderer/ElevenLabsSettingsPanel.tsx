import { useEffect, useState } from "react";

export default function ElevenLabsSettingsPanel() {
  const [key, setKey] = useState("");
  const [configured, setConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    void window.videoEditor.getContentProviderStatus().then(status => {
      if (active) setConfigured(Boolean(status.elevenLabsConfigured));
    }).catch(() => { if (active) setMessage("ไม่สามารถอ่านสถานะการเชื่อมต่อได้"); });
    return () => { active = false; };
  }, []);
  const save = async () => {
    if (!key.trim()) return;
    setBusy(true);
    setMessage("");
    try {
      await window.videoEditor.saveElevenLabsApiKey(key.trim());
      setKey("");
      setConfigured(true);
      setMessage("บันทึกคีย์แล้ว กรุณากดทดสอบการเชื่อมต่อ");
    } catch {
      setMessage("บันทึกคีย์ไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally { setBusy(false); }
  };
  const test = async () => {
    setBusy(true);
    setMessage("");
    try {
      const result = await window.videoEditor.checkProviderConnection("elevenlabs");
      setConfigured(result.configured);
      setMessage(result.connected ? "เชื่อมต่อ ElevenLabs สำเร็จ" : "เชื่อมต่อไม่สำเร็จ: " + result.status);
    } catch {
      setMessage("ไม่สามารถทดสอบการเชื่อมต่อได้");
    } finally { setBusy(false); }
  };
  return <section className="voiceStudioPanel" id="api-settings" aria-label="ตั้งค่า ElevenLabs">
    <h2>ตั้งค่าระบบเสียง ElevenLabs</h2>
    <p className="muted">บันทึกคีย์ไว้ในแอปโดยไม่แสดงคีย์เดิม และทดสอบการเชื่อมต่อโดยไม่สร้างเสียงหรือใช้เครดิตสร้างเสียง</p>
    <p>{configured ? "มี API Key ที่บันทึกไว้" : "ยังไม่ได้ตั้งค่า API Key"}</p>
    <div className="voiceStudioActions">
      <label>ElevenLabs API Key <input type="password" autoComplete="off" value={key} onChange={event => setKey(event.target.value)} placeholder="วางคีย์เพื่อบันทึกหรือเปลี่ยนคีย์" /></label>
      <button type="button" disabled={busy || !key.trim()} onClick={() => void save()}>บันทึกคีย์</button>
      <button type="button" disabled={busy || !configured} onClick={() => void test()}>ทดสอบการเชื่อมต่อ</button>
    </div>
    {message && <p role="status">{message}</p>}
  </section>;
}
