/**
 * What the installed Windows app adds to the screens (see
 * installer/src/preload.ts). In a normal browser this is undefined and the
 * screens fall back to browser behaviour (e.g. the print dialog).
 */
export type PrintJob = {
  html: string;
  /** Roll width for thermal paper; A4/A5 come from the page itself */
  widthMm?: number;
  /** Label printers: exact label size */
  heightMm?: number;
  /** Printer name; empty = ask with the print dialog */
  printer?: string;
  copies?: number;
};

export type DesktopBridge = {
  openSetup: () => Promise<void>;
  openDataFolder: () => Promise<void>;
  listPrinters: () => Promise<{ name: string; isDefault: boolean }[]>;
  print: (job: PrintJob) => Promise<{ ok: boolean; error?: string }>;
};

export const desktopBridge = (): DesktopBridge | undefined =>
  typeof window === "undefined"
    ? undefined
    : (window as unknown as { medicareDesktop?: DesktopBridge })
        .medicareDesktop;
