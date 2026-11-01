import { app, BrowserWindow, dialog } from "electron";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { access, mkdtemp, readFile, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
// The user provided these MyCut 1.0.1 resources. Do not bundle or publish them.
const VERIFIED_ASAR_SHA256 = "f7f4f66962deda6002a8073df78533b3f0782fb7c3d3fca0f3b432534b391d7c";
const FILES_DIR = "mycut-local-resources-1.0.1";
let bootstrapped = false;
let reopenMyCutWindow: (() => void) | null = null;

function resourcesFolder(): string {
  return path.join(app.getPath("userData"), FILES_DIR, "resources");
}

export async function isMyCutInstalledLocally(): Promise<boolean> {
  try {
    const folder = resourcesFolder();
    await access(path.join(folder, "app.asar"));
    await access(path.join(folder, "app.asar.unpacked"));
    const hash = createHash("sha256").update(await readFile(path.join(folder, "app.asar"))).digest("hex");
    return hash === VERIFIED_ASAR_SHA256;
  } catch { return false; }
}

/** One-time *local* import; MyCut's binaries are never committed to this repository. */
export async function importMyCutResourcesZip(): Promise<boolean> {
  if (process.platform !== "win32") throw new Error("MyCut resources import currently requires Windows");
  if (await isMyCutInstalledLocally()) return true;
  const selected = await dialog.showOpenDialog({
    title: "เลือกไฟล์ resources ZIP ของ MyCut 1.0.1",
    properties: ["openFile"],
    filters: [{ name: "MyCut resources ZIP", extensions: ["zip"] }]
  });
  if (selected.canceled || !selected.filePaths[0]) return false;
  const zip = selected.filePaths[0];
  const { stdout } = await execFileAsync("tar.exe", ["-tf", zip], { windowsHide: true, maxBuffer: 1024 * 1024 });
  const names = stdout.split(/\r?\n/).filter(Boolean).map(x => x.replace(/\\/g, "/"));
  if (!names.includes("resources/app.asar") ||
      !names.some(x => x.startsWith("resources/app.asar.unpacked/")) ||
      names.some(x => !x.startsWith("resources/") || x.split("/").includes("..") || x.includes(":"))) {
    throw new Error("ZIP ไม่ใช่แพ็กเกจ resources ของ MyCut ที่รองรับ");
  }
  const base = app.getPath("userData");
  const temp = await mkdtemp(path.join(base, "mycut-import-"));
  try {
    await execFileAsync("tar.exe", ["-xf", zip, "-C", temp], { windowsHide: true, timeout: 120000 });
    const asar = path.join(temp, "resources", "app.asar");
    const info = await stat(asar);
    if (!info.isFile() || info.size < 100000 || info.size > 100000000) throw new Error("MyCut app.asar ไม่ถูกต้อง");
    const hash = createHash("sha256").update(await readFile(asar)).digest("hex");
    if (hash !== VERIFIED_ASAR_SHA256) throw new Error("แพ็กเกจ MyCut ไม่ตรงกับ resources(1).zip ที่ตรวจสอบไว้");
    const root = path.join(base, FILES_DIR);
    await rename(temp, root);
    return true;
  } finally {
    await rm(temp, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Loads the user's original MyCut UI + main handlers into our Electron process.
 * Only alters application-global lifecycle/name/data-path calls and file loading;
 * it does not modify MyCut's original resources on disk.
 * MyCut opens in its own editor window (same running app, no separate EXE).
 */
export async function openLocalMyCutEditor(): Promise<void> {
  if (!(await isMyCutInstalledLocally())) throw new Error("นำเข้า resources ZIP ของ MyCut 1.0.1 ก่อน");
  const existing = BrowserWindow.getAllWindows().find(win => !win.isDestroyed() && win.getTitle() === "MyCut");
  if (existing) { existing.show(); existing.focus(); return; }
  if (bootstrapped) {
    if (!reopenMyCutWindow) throw new Error("MyCut ยังเริ่มต้นไม่สมบูรณ์");
    reopenMyCutWindow();
    return;
  }
  const root = resourcesFolder();
  const entry = path.join(root, "app.asar", "main.js");
  let source = await readFile(entry, "utf8");
  const replacements: Array<[string,string]> = [
    ['process.env.MYCUT_USERDATA&&app.setPath("userData",process.env.MYCUT_USERDATA),app.setName("MyCut"),"win32"===process.platform&&app.setAppUserModelId("MyCut");', ''],
    ['app.whenReady().then(()=>{Menu.setApplicationMenu(null),ensureDirs(),createWindow()})', 'app.whenReady().then(()=>{ensureDirs(),createWindow()})'],
    ['app.on("window-all-closed",()=>app.quit())', 'void 0'],
    ['win.loadFile("index.html")', 'win.loadFile(path.join(__dirname,"index.html"))']
  ];
  for (const [from, to] of replacements) {
    if (!source.includes(from)) throw new Error("โครงสร้าง MyCut เวอร์ชันนี้ไม่ตรงกับตัวเชื่อมที่ตรวจสอบไว้");
    source = source.replace(from, to);
  }
  // Keep the MyCut's personal project files separate from AI Video Editor's.
  const userDir = path.join(app.getPath("userData"), "mycut-personal-workspace");
  source = source.replaceAll('app.getPath("userData")', JSON.stringify(userDir));
  source += "\nmodule.exports.__openHostedMyCutWindow = createWindow;";
  bootstrapped = true;
  try {
    // Evaluates only the checksum-verified, user-imported MyCut 1.0.1 main script.
    const compiled = new Function("require", "module", "exports", "__filename", "__dirname", source);
    const moduleLike = { exports: {} };
    compiled(createRequire(entry), moduleLike, moduleLike.exports, entry, path.dirname(entry));
    const exported = moduleLike.exports as { __openHostedMyCutWindow?: () => void };
    reopenMyCutWindow = exported.__openHostedMyCutWindow ?? null;
  } catch (error) {
    bootstrapped = false;
    reopenMyCutWindow = null;
    throw error;
  }
}
