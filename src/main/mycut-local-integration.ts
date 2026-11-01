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
let hostedMyCutWindow: BrowserWindow | null = null;

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
  // Accept both the standalone resources ZIP and the full MyCut install ZIP.
  // Import ONLY resources/, never the user's executable or other installer files.
  const resources = names.filter(name => name === "resources/" || name.startsWith("resources/"));
  if (!resources.includes("resources/app.asar") ||
      !resources.some(name => name.startsWith("resources/app.asar.unpacked/")) ||
      resources.some(name => name.split("/").includes("..") || name.includes(":"))) {
    throw new Error("ZIP ไม่ใช่แพ็กเกจ MyCut 1.0.1 ที่รองรับ");
  }
  const base = app.getPath("userData");
  const temp = await mkdtemp(path.join(base, "mycut-import-"));
  try {
    await execFileAsync("tar.exe", ["-xf", zip, "-C", temp, "resources/"], { windowsHide: true, timeout: 120000 });
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
/**
 * MyCut's renderer defines openProjectById in its classic renderer.js. Wait
 * until its project grid has loaded before opening the imported episode.
 * This avoids asking the user to hunt through the MyCut project library.
 */
function openImportedProjectInMyCut(win: BrowserWindow, projectId: string): void {
  const script = `(() => new Promise((resolve, reject) => {
    let attempts = 0;
    const open = () => {
      if (typeof openProjectById === "function" &&
          document.querySelector("#projGrid .proj-card")) {
        Promise.resolve(openProjectById(${JSON.stringify(projectId)}))
          .then(() => resolve(true), reject);
      } else if (++attempts >= 80) {
        reject(new Error("MyCut project list did not load"));
      } else {
        setTimeout(open, 100);
      }
    };
    open();
  }))()`;
  void win.webContents.executeJavaScript(script).catch(error => {
    console.error("MyCut could not open imported episode", error);
    if (!win.isDestroyed()) {
      void dialog.showMessageBox(win, {
        type: "warning",
        title: "เปิดตอนใน MyCut ไม่สำเร็จ",
        message: "เปิด MyCut ได้แล้ว แต่ยังเปิดตอนที่นำเข้าโดยอัตโนมัติไม่ได้",
        detail: "โปรเจกต์ที่ส่งไว้ยังอยู่ในคลัง MyCut สามารถเปิดจากหน้ารายการได้โดยตรง\\n" +
          String(error instanceof Error ? error.message : error),
        buttons: ["ตกลง"]
      }).catch(() => {});
    }
  });
}

function focusMyCutAsPrimaryWindow(open: () => void, projectId?: string, requestedHost?: BrowserWindow | null): void {
  // A native Windows file picker can remove focus from the original window.
  // Prefer the authenticated IPC sender over the currently focused window.
  const host = requestedHost && !requestedHost.isDestroyed() ? requestedHost : BrowserWindow.getFocusedWindow();
  const onCreated = (_event: Electron.Event, child: BrowserWindow) => {
    if (child === host) return;
    hostedMyCutWindow = child;
    child.once("closed", () => { if (hostedMyCutWindow === child) hostedMyCutWindow = null; });
    // Failure during HTML/preload initialization must be visible, not a blank
    // MyCut window that leaves users thinking the editor is still loading.
    let launchErrorReported = false;
    const reportLaunchError = (reason: string) => {
      if (launchErrorReported) return;
      launchErrorReported = true;
      if (host && !host.isDestroyed()) { host.show(); host.focus(); }
      void dialog.showMessageBox({
        type: "error",
        title: "ไม่สามารถเปิดหน้าตัดต่อ MyCut",
        message: "MyCut ไม่สามารถโหลดหน้าตัดต่อได้",
        detail: reason + "\\nกรุณาตรวจสอบไฟล์ MyCut ที่นำเข้า และส่งข้อความข้อผิดพลาดนี้มาตรวจสอบ",
        buttons: ["ตกลง"]
      }).catch(() => {});
    };
    child.webContents.on("did-fail-load", (_event, code, description, _url, isMainFrame) => {
      if (isMainFrame && code !== -3) reportLaunchError(description + " (" + code + ")");
    });
    child.webContents.once("render-process-gone", (_event, details) => {
      reportLaunchError("MyCut renderer stopped: " + details.reason);
    });
    if (projectId) {
      child.webContents.once("did-finish-load", () => openImportedProjectInMyCut(child, projectId));
    }
    if (host && !host.isDestroyed()) {
      child.once("ready-to-show", () => { if (!host.isDestroyed()) host.hide(); });
      child.once("closed", () => {
        if (!host.isDestroyed()) { host.show(); host.focus(); }
      });
    }
  };
  app.once("browser-window-created", onCreated);
  try { open(); }
  catch (error) {
    app.removeListener("browser-window-created", onCreated);
    throw error;
  }
}

export async function openLocalMyCutEditor(projectId?: string, host?: BrowserWindow | null): Promise<void> {
  if (projectId !== undefined && !/^p-[a-f0-9-]{36}$/i.test(projectId)) {
    throw new Error("MyCut project ID ไม่ถูกต้อง");
  }
  if (!(await isMyCutInstalledLocally())) throw new Error("นำเข้า resources ZIP ของ MyCut 1.0.1 ก่อน");
  const existing = hostedMyCutWindow && !hostedMyCutWindow.isDestroyed() ? hostedMyCutWindow : null;
  if (existing) {
    if (host && !host.isDestroyed() && host !== existing) {
      // Visiting the editor from a newly focused AI window must hide it too.
      const restoreHost = () => {
        if (!host.isDestroyed()) { host.show(); host.focus(); }
      };
      existing.once("closed", restoreHost);
      host.hide();
    }
    existing.show();
    existing.focus();
    if (projectId) openImportedProjectInMyCut(existing, projectId);
    return;
  }
  if (bootstrapped) {
    if (!reopenMyCutWindow) throw new Error("MyCut ยังเริ่มต้นไม่สมบูรณ์");
    focusMyCutAsPrimaryWindow(reopenMyCutWindow, projectId, host);
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
    focusMyCutAsPrimaryWindow(() => {
      compiled(createRequire(entry), moduleLike, moduleLike.exports, entry, path.dirname(entry));
    }, projectId, host);
    const exported = moduleLike.exports as { __openHostedMyCutWindow?: () => void };
    reopenMyCutWindow = exported.__openHostedMyCutWindow ?? null;
  } catch (error) {
    bootstrapped = false;
    reopenMyCutWindow = null;
    throw error;
  }
}
