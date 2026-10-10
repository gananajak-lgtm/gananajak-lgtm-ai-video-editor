import { useEffect, useState } from "react";

export default function ElevenLabsSettingsPanel() {
  const [key, setKey] = useState("");
  const [newName, setNewName] = useState("");
  const [newKey, setNewKey] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
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
      setNewName(""); setNewKey(""); setCredits(null); setShowAddForm(false);
      await refreshWorkspaces(); window.dispatchEvent(new Event("elevenlabs-workspace-changed")); setMessage("เพิ่ม Workspace และเลือกใช้งานแล้ว");
    } catch (error) { setMessage(error instanceof Error ? error.message : "เพิ่ม Workspace ไม่สำเร็จ"); }
    finally { setBusy(false); }
  };
  const switchWorkspace = async (id: string) => {
    setBusy(true); setMessage(""); setCredits(null); setCreditMessage("");
    try {
      await window.videoEditor.selectElevenLabsWorkspace(id);
      await refreshWorkspaces(); window.dispatchEvent(new Event("elevenlabs-workspace-changed")); setMessage("สลับ Workspace แล้ว");
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
  return <section className="voiceStudioPanel premiumVoicePanel" id="api-settings" aria-label="ตั้งค่า ElevenLabs">
    <div className="premiumHeading"><div><p className="eyebrow">AI VOICE STUDIO · WORKSPACE CONTROL</p><h2>✦ ตั้งค่าระบบเสียง ElevenLabs</h2></div><span className="premiumHeadingIcon">♫</span></div>
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
      <p><strong>บัญชีที่บันทึกไว้ทั้งหมด: {workspaces.length} บัญชี</strong></p>
      <div className="premiumWorkspaceGrid studioAccountGrid">{workspaces.map((item, index) => <button key={item.id} type="button" disabled={busy} className={`premiumWorkspaceCard ${activeId === item.id ? "isActive" : ""}`} onClick={() => void switchWorkspace(item.id)}><span className="premiumWorkspaceIndex">{String(index + 1).padStart(2, "0")}</span><span className="premiumWorkspaceName">{item.name}</span><span className="studioAccountBalance">{activeId === item.id && credits ? `เหลือ ${credits.remaining?.toLocaleString() ?? "ไม่ทราบ"}` : "กดเลือกเพื่อตรวจสอบเครดิต"}</span><span className="premiumWorkspaceState"><span className="premiumStatusDot" />{activeId === item.id ? "กำลังใช้งาน" : "เลือกใช้งาน"}</span>{activeId === item.id && credits && <span className="premiumWorkspaceCredit">คงเหลือ {credits.remaining?.toLocaleString() ?? "ไม่ทราบ"}</span>}</button>)}</div>
      <div className="voiceStudioActions">
        <button type="button" disabled={busy} onClick={() => setShowAddForm(previous => !previous)}>{showAddForm ? "ยกเลิกการเพิ่มบัญชี" : "＋ เพิ่มบัญชี ElevenLabs อีกบัญชี"}</button>
        <label>Workspace ที่ใช้งาน <select value={activeId} disabled={busy} onChange={event => void switchWorkspace(event.target.value)}>
          {workspaces.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label>
        <button type="button" disabled={busy || !activeId} onClick={() => void refreshCredits()}>รีเฟรชเครดิตจริง</button>
      </div>
      {credits && <div className="premiumCreditDetail studioCreditDetail"><p>ใช้ไปแล้ว: {credits.used?.toLocaleString() ?? "ไม่ทราบ"} · โควตา: {credits.limit?.toLocaleString() ?? "ไม่ทราบ"} · คงเหลือ: <strong>{credits.remaining?.toLocaleString() ?? "ไม่ทราบ"}</strong></p>
        {credits.limit !== null && credits.used !== null && credits.limit > 0 && <progress max={credits.limit} value={Math.min(credits.limit, credits.used)} />}
        {credits.resetAt !== null && <p className="muted">รอบถัดไป: {new Date(credits.resetAt * 1000).toLocaleString("th-TH")}</p>}
      </div>}
      {creditMessage && <p role="status">{creditMessage}</p>}
      <div className="voiceStudioActions" aria-label="รายการบัญชี ElevenLabs" style={{ display: "none" }}>
        {workspaces.map(item => <button type="button" key={item.id} disabled={busy || activeId === item.id} onClick={() => void switchWorkspace(item.id)}>{item.name}{activeId === item.id ? " ✓ กำลังใช้งาน" : " — เลือกใช้"}</button>)}
      </div>
      {showAddForm && <div className="voiceRegistry">
      <h3>เพิ่มบัญชี ElevenLabs ใหม่</h3>
      <div className="voiceStudioActions">
        <label>ชื่อ Workspace <input value={newName} onChange={event => setNewName(event.target.value)} placeholder="เช่น บัญชีนิยาย" /></label>
        <label>API Key ของ Workspace <input type="password" autoComplete="off" value={newKey} onChange={event => setNewKey(event.target.value)} placeholder="วาง API Key ของบัญชีนี้" /></label>
        <button type="button" disabled={busy || !newName.trim() || !newKey.trim()} onClick={() => void addWorkspace()}>＋ บันทึกบัญชีนี้และเพิ่มในรายการ</button>
      </div>
      </div>}
    </div>
    {message && <p role="status">{message}</p>}
  </section>;
}
