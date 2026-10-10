import { useEffect, useState } from "react";

export default function ElevenLabsSettingsPanel() {
  const [key, setKey] = useState("");
  const [newName, setNewName] = useState("");
  const [newKey, setNewKey] = useState("");
  const [workspaces, setWorkspaces] = useState<Array<{ id: string; name: string; configured: boolean }>>([]);
  const [activeId, setActiveId] = useState("");
  const [credits, setCredits] = useState<{ used: number | null; limit: number | null; remaining: number | null; resetAt: number | null } | null>(null);
  const [creditMessage, setCreditMessage] = useState("");
  const refreshWorkspaces = async () => {
    const result = await window.videoEditor.listElevenLabsWorkspaces();
    setWorkspaces(result.workspaces); setActiveId(result.activeId);
  };
  const refreshCredits = async () => {
    setCredits(null); setCreditMessage("กำลังอ่านยอดจาก ElevenLabs...");
    try { setCredits(await window.videoEditor.getElevenLabsSubscription()); setCreditMessage(""); }
    catch (error) { setCreditMessage(error instanceof Error ? error.message : "ไม่สามารถอ่านเครดิตได้ กรุณาตรวจสอบสิทธิ์ API Key"); }
  };
  const addWorkspace = async () => {
    setBusy(true); setMessage("");
    try {
      await window.videoEditor.addElevenLabsWorkspace(newName, newKey);
      setNewName(""); setNewKey(""); setCredits(null);
      await refreshWorkspaces(); setMessage("เพิ่ม Workspace และเลือกใช้งานแล้ว");
    } catch (error) { setMessage(error instanceof Error ? error.message : "เพิ่ม Workspace ไม่สำเร็จ"); }
    finally { setBusy(false); }
  };
  const switchWorkspace = async (id: string) => {
    setBusy(true); setMessage(""); setCredits(null); setCreditMessage("");
    try {
      await window.videoEditor.selectElevenLabsWorkspace(id);
      await refreshWorkspaces(); setMessage("สลับ Workspace แล้ว");
    } catch { setMessage("สลับ Workspace ไม่สำเร็จ"); }
    finally { setBusy(false); }
  };
  const [configured, setConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    void window.videoEditor.getContentProviderStatus().then(status => {
      if (active) setConfigured(Boolean(status.elevenLabsConfigured));
    }).catch(() => { if (active) setMessage("ไม่สามารถอ่านสถานะการเชื่อมต่อได้"); });
    void refreshWorkspaces().catch(() => { if (active) setMessage("โหลดรายการ Workspace ไม่สำเร็จ"); });
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
    <div className="voiceRegistry">
      <h3>จัดการหลาย Workspace</h3>
      <p className="muted">เลือกบัญชีที่จะใช้กับการดึงเสียงและสร้างเสียงพากย์ คีย์แต่ละบัญชีเข้ารหัสไว้ในเครื่อง และไม่แสดงคีย์เดิม</p>
      <div className="voiceStudioActions">
        <label>Workspace ที่ใช้งาน <select value={activeId} disabled={busy} onChange={event => void switchWorkspace(event.target.value)}>
          {workspaces.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label>
        <button type="button" disabled={busy || !activeId} onClick={() => void refreshCredits()}>รีเฟรชเครดิตจริง</button>
      </div>
      {credits && <div><p>ใช้ไปแล้ว: {credits.used?.toLocaleString() ?? "ไม่ทราบ"} · โควตา: {credits.limit?.toLocaleString() ?? "ไม่ทราบ"} · คงเหลือ: <strong>{credits.remaining?.toLocaleString() ?? "ไม่ทราบ"}</strong></p>
        {credits.limit !== null && credits.used !== null && credits.limit > 0 && <progress max={credits.limit} value={Math.min(credits.limit, credits.used)} />}
        {credits.resetAt !== null && <p className="muted">รอบถัดไป: {new Date(credits.resetAt * 1000).toLocaleString("th-TH")}</p>}
      </div>}
      {creditMessage && <p role="status">{creditMessage}</p>}
      <h3>เพิ่ม Workspace ใหม่</h3>
      <div className="voiceStudioActions">
        <label>ชื่อ Workspace <input value={newName} onChange={event => setNewName(event.target.value)} placeholder="เช่น บัญชีนิยาย" /></label>
        <label>API Key ของ Workspace <input type="password" autoComplete="off" value={newKey} onChange={event => setNewKey(event.target.value)} placeholder="วาง API Key ของบัญชีนี้" /></label>
        <button type="button" disabled={busy || !newName.trim() || !newKey.trim()} onClick={() => void addWorkspace()}>เพิ่มและเลือกใช้งาน</button>
      </div>
    </div>
    {message && <p role="status">{message}</p>
  </section>;
}
