/**
 * MediCare Pharmacy — the installed Windows app.
 *
 * One program, two ways to use it (chosen once, on the first start):
 *  • MAIN computer: keeps the shop's data. Runs the server inside the app
 *    (database, daily backups) and shows the screens. Can share itself on
 *    the shop network so other counters can connect.
 *  • Extra COUNTER: keeps no data; opens the main computer's address.
 *
 * Nothing else to install: no separate server, no Node.js, no database.
 */
import { app, BrowserWindow, dialog, ipcMain, session, shell } from "electron";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { startServer } from "../../apps/server/src/server";
import { checkNow, startUpdates, updateState } from "./updates";

type Config = {
  role: "main" | "counter";
  /** Counter: the main computer, e.g. http://192.168.1.10:4000 */
  mainUrl?: string;
  /** Main: share on the shop network */
  lan?: boolean;
  /** Main: start with the demo shop (to try the app) */
  demo?: boolean;
};
type Server = Awaited<ReturnType<typeof startServer>>;

const PORT = 4000;
const HERE = dirname(fileURLToPath(import.meta.url));
/** Files shipped next to the app (screens, table updates, setup page) */
const res = (...p: string[]) =>
  app.isPackaged
    ? join(process.resourcesPath, ...p)
    : join(HERE, "..", "res", ...p);
const DATA = () => join(app.getPath("userData"), "data");
const CONFIG = () => join(app.getPath("userData"), "config.json");

let win: BrowserWindow | null = null;
let server: Server | null = null;
let config: Config | null = null;

function readConfig(): Config | null {
  try {
    const c = JSON.parse(readFileSync(CONFIG(), "utf8")) as Config;
    return c.role === "main" || (c.role === "counter" && c.mainUrl) ? c : null;
  } catch {
    return null;
  }
}
function saveConfig(c: Config) {
  mkdirSync(dirname(CONFIG()), { recursive: true });
  writeFileSync(CONFIG(), JSON.stringify(c, null, 2));
  config = c;
}

/** Start (or restart) the built-in server for the MAIN computer */
async function runServer(c: Config) {
  await server?.close();
  server = null;
  process.env.MIGRATIONS_DIR = res("drizzle");
  process.env.LICENSE_ENFORCE = "1"; // trial / licence key / on hold
  server = await startServer({
    dbFile: join(DATA(), "medicare.sqlite"),
    backupDir: join(DATA(), "backups"),
    host: c.lan ? "0.0.0.0" : "127.0.0.1",
    port: PORT,
    appDir: res("app-ui"),
    demo: c.demo === true,
    // Settings → Shop network: switch sharing on/off
    setLan: async (on) => {
      saveConfig({ ...c, lan: on });
      await runServer(config!);
    },
  });
}

function openSetup() {
  win?.loadFile(res("setup.html"));
}

/** Show the shop: local server (main) or the main computer (counter) */
async function openShop() {
  if (!win || !config) return;
  if (config.role === "main") {
    try {
      if (!server) await runServer(config);
    } catch (err) {
      const busy = /EADDRINUSE/.test(String(err));
      dialog.showErrorBox(
        "MediCare could not start",
        busy
          ? `Port ${PORT} is already in use. Is MediCare (or its server) already running on this computer?`
          : String(err instanceof Error ? err.message : err),
      );
      app.quit();
      return;
    }
    await win.loadURL(`http://127.0.0.1:${PORT}/`);
  } else {
    await win.loadURL(config.mainUrl!).catch(() => {});
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 1100,
    minHeight: 680,
    show: false,
    title: "MediCare Pharmacy",
    icon: res("icon.png"),
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(HERE, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.removeMenu();
  win.once("ready-to-show", () => {
    win?.maximize();
    win?.show();
  });

  // Counter can't reach the main computer → friendly page with Retry
  win.webContents.on("did-fail-load", (_e, code, _desc, url, isMain) => {
    if (!isMain || code === -3 || url.startsWith("file:")) return;
    void win?.loadFile(res("setup.html"), {
      query: { offline: url },
    });
  });

  // Links to other sites open in the normal browser, never inside the app
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  // The window never leaves the shop's own pages
  win.webContents.on("will-navigate", (e, url) => {
    if (isOurs(url)) return;
    e.preventDefault();
    if (/^https?:/.test(url)) void shell.openExternal(url);
  });

  // A few keys a desktop app needs (there is no menu bar)
  win.webContents.on("before-input-event", (e, input) => {
    if (input.type !== "keyDown") return;
    const ctrl = input.control || input.meta;
    const k = input.key.toLowerCase();
    const wc = win!.webContents;
    if (input.key === "F5" || (ctrl && k === "r")) wc.reload();
    // Developer tools only in development, not in the installed app
    else if (ctrl && input.shift && k === "i" && !app.isPackaged)
      wc.toggleDevTools();
    else if (ctrl && (k === "=" || k === "+"))
      wc.setZoomLevel(wc.getZoomLevel() + 0.5);
    else if (ctrl && k === "-") wc.setZoomLevel(wc.getZoomLevel() - 0.5);
    else if (ctrl && k === "0") wc.setZoomLevel(0);
    else if (input.key === "F11") win!.setFullScreen(!win!.isFullScreen());
    else if (ctrl && input.shift && k === "s") openSetup();
    else return;
    e.preventDefault();
  });

  // Main computer sharing with counters: closing would stop them all
  win.on("close", (e) => {
    if (config?.role !== "main" || !config.lan) return;
    const choice = dialog.showMessageBoxSync(win!, {
      type: "warning",
      buttons: ["Minimize instead", "Close anyway"],
      defaultId: 0,
      cancelId: 0,
      title: "Other counters are connected",
      message: "This is the main computer.",
      detail:
        "Other counters on the shop network use this computer. If you close MediCare here, they stop working until it is opened again.",
    });
    if (choice === 0) {
      e.preventDefault();
      win?.minimize();
    }
  });
}

/* ---- What our pages may ask (and nobody else) ---- */

/** The shop's own pages: setup page, this computer's server, or the main computer */
function isOurs(url: string): boolean {
  if (url.startsWith("file:")) return url.startsWith(pathToFileURL(res()).href);
  try {
    const origin = new URL(url).origin;
    return (
      origin === `http://127.0.0.1:${PORT}` ||
      (config?.role === "counter" && origin === new URL(config.mainUrl!).origin)
    );
  } catch {
    return false;
  }
}

/** ipcMain.handle, but refuses calls from any page that isn't ours */
function handle<A extends unknown[], R>(
  channel: string,
  fn: (e: Electron.IpcMainInvokeEvent, ...args: A) => R,
) {
  ipcMain.handle(channel, (e, ...args) => {
    if (!isOurs(e.senderFrame?.url ?? "")) throw new Error("Not allowed");
    return fn(e, ...(args as A));
  });
}

/* ---- Setup page (first start, or "Change setup") ---- */

handle("setup:get", () => ({
  config,
  dataDir: DATA(),
}));

handle("setup:test", async (_e, url: string) => {
  try {
    const r = await fetch(new URL("/health", url), {
      signal: AbortSignal.timeout(4000),
    });
    const body = (await r.json()) as { service?: string };
    return body.service === "medicare-server"
      ? { ok: true }
      : { ok: false, error: "That address is not a MediCare main computer." };
  } catch {
    return {
      ok: false,
      error:
        "Can't reach it. Is MediCare open on the main computer, with shop-network sharing on?",
    };
  }
});

handle("setup:save", async (_e, c: Config) => {
  const clean: Config =
    c.role === "counter"
      ? { role: "counter", mainUrl: new URL(String(c.mainUrl)).origin }
      : { role: "main", lan: c.lan === true, demo: c.demo === true };
  if (clean.role !== config?.role && server) {
    await server.close();
    server = null;
  }
  saveConfig(clean);
  await openShop();
});

handle("app:open-setup", () => openSetup());
handle("app:open-data-folder", () => shell.openPath(DATA()));
handle("app:updates", () => updateState());
handle("app:check-updates", () => checkNow());
handle("app:retry", () => openShop());

/* ---- Printing: straight to the chosen printer, right paper size ---- */

handle("print:list", async () =>
  ((await win?.webContents.getPrintersAsync()) ?? []).map((p) => ({
    name: p.name,
    isDefault: (p as { isDefault?: boolean }).isDefault === true,
  })),
);

type PrintJob = {
  html: string;
  widthMm?: number;
  heightMm?: number;
  printer?: string;
  copies?: number;
};

handle("print:html", async (_e, job: PrintJob) => {
  if (typeof job?.html !== "string" || job.html.length > 5_000_000)
    return { ok: false, error: "Nothing to print" };
  // A hidden page with ONLY the bill — never the app screen behind it
  const page = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, contextIsolation: true },
  });
  try {
    await page.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(job.html)}`,
    );
    const mm = (n: number) => Math.round(n * 1000); // microns
    let pageSize: Electron.WebContentsPrintOptions["pageSize"];
    if (job.widthMm && job.heightMm)
      pageSize = { width: mm(job.widthMm), height: mm(job.heightMm) };
    else if (job.widthMm && job.widthMm <= 80) {
      // Thermal roll: as long as the bill (+ a little to tear off)
      const px = (await page.webContents.executeJavaScript(
        "document.documentElement.scrollHeight",
      )) as number;
      pageSize = {
        width: mm(job.widthMm),
        height: mm(Math.max(60, (px * 25.4) / 96 + 12)),
      };
    } // A4/A5: the page says its own size (@page)
    return await new Promise<{ ok: boolean; error?: string }>((resolve) =>
      page.webContents.print(
        {
          silent: !!job.printer,
          deviceName: job.printer || undefined,
          copies: Math.min(Math.max(job.copies ?? 1, 1), 3),
          printBackground: true,
          ...(pageSize ? { pageSize, margins: { marginType: "none" } } : {}),
        },
        (ok, reason) => resolve({ ok, error: ok ? undefined : reason }),
      ),
    );
  } finally {
    page.destroy();
  }
});

/* ---- Start ---- */

if (!app.requestSingleInstanceLock()) {
  app.quit(); // already open → the first window comes to the front
} else {
  app.on("second-instance", () => {
    if (win?.isMinimized()) win.restore();
    win?.focus();
  });
  app.setAppUserModelId("in.medicare.pharmacy");

  void app.whenReady().then(async () => {
    // Pages get no camera, microphone, location, notifications… — only "copy"
    session.defaultSession.setPermissionRequestHandler((_wc, perm, ok) =>
      ok(perm === "clipboard-sanitized-write"),
    );
    createWindow();
    startUpdates(() => win);
    config = readConfig();
    if (config) await openShop();
    else openSetup();
  });
  app.on("window-all-closed", () => app.quit());
  // Close the database cleanly before the app exits
  app.on("before-quit", (e) => {
    if (!server) return;
    e.preventDefault();
    const s = server;
    server = null;
    void s.close().finally(() => app.quit());
  });
}
