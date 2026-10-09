/**
 * The few things a page may ask the installed app to do. Nothing else of
 * the computer is reachable from the pages (no Node, no files).
 */
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("medicareDesktop", {
  /** Setup page */
  getSetup: () => ipcRenderer.invoke("setup:get"),
  testConnection: (url: string) => ipcRenderer.invoke("setup:test", url),
  saveSetup: (config: unknown) => ipcRenderer.invoke("setup:save", config),
  retry: () => ipcRenderer.invoke("app:retry"),
  /** Settings → This computer */
  openSetup: () => ipcRenderer.invoke("app:open-setup"),
  openDataFolder: () => ipcRenderer.invoke("app:open-data-folder"),
  chooseFolder: () => ipcRenderer.invoke("app:choose-folder"),
  /** Version + automatic updates */
  updates: () => ipcRenderer.invoke("app:updates"),
  checkUpdates: () => ipcRenderer.invoke("app:check-updates"),
  /** Printing (bills, barcode labels) */
  listPrinters: () => ipcRenderer.invoke("print:list"),
  print: (job: unknown) => ipcRenderer.invoke("print:html", job),
});
