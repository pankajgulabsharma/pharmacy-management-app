/**
 * Free automatic updates from GitHub Releases (electron-updater).
 * Checks when the app starts and every 6 hours; downloads quietly; when
 * ready, asks "Restart now / Later" — "Later" installs on the next close.
 * The shop's data is never touched by an update.
 */
import { app, dialog, type BrowserWindow } from "electron";
import electronUpdater from "electron-updater";
import { existsSync } from "node:fs";
import { join } from "node:path";

const { autoUpdater } = electronUpdater;
const SIX_HOURS = 6 * 3_600_000;

export type UpdateState = {
  version: string;
  status: "off" | "idle" | "checking" | "downloading" | "ready" | "error";
  available?: string;
};

const state: UpdateState = { version: app.getVersion(), status: "off" };
export const updateState = () => ({ ...state });

export function startUpdates(win: () => BrowserWindow | null) {
  // Only an installed app built by the release workflow (it writes
  // app-update.yml) updates itself — not development or local builds
  if (
    !app.isPackaged ||
    !existsSync(join(process.resourcesPath, "app-update.yml"))
  )
    return;
  state.status = "idle";
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("checking-for-update", () => (state.status = "checking"));
  autoUpdater.on("update-not-available", () => (state.status = "idle"));
  autoUpdater.on("update-available", (i) => {
    state.status = "downloading";
    state.available = i.version;
  });
  autoUpdater.on("error", () => (state.status = "error")); // offline: try later
  autoUpdater.on("update-downloaded", (i) => {
    state.status = "ready";
    const w = win();
    const ask = {
      type: "info" as const,
      buttons: ["Restart now", "Later"],
      defaultId: 1,
      cancelId: 1,
      title: "Update ready",
      message: `MediCare ${i.version} is ready to install.`,
      detail:
        "Restart now (takes a few seconds), or it installs by itself the next time MediCare is closed. Your data is not changed.",
    };
    void (w ? dialog.showMessageBox(w, ask) : dialog.showMessageBox(ask)).then(
      (r) => {
        if (r.response === 0) autoUpdater.quitAndInstall();
      },
    );
  });
  void checkNow();
  setInterval(() => void checkNow(), SIX_HOURS).unref();
}

export async function checkNow() {
  if (state.status === "off") return updateState();
  try {
    await autoUpdater.checkForUpdates();
  } catch {
    state.status = "error";
  }
  return updateState();
}
