import { create } from "zustand";
import { apiGet } from "@/lib/api";
import { daysSince, type Offsite } from "./types";

type Health = { lastBackupAt: string | null; offsite: Offsite };

type Store = {
  health: Health | null;
  refresh: () => Promise<void>;
  /** Start checking (owner only) — every 10 minutes, once per app */
  watch: () => void;
};

let timer: ReturnType<typeof setInterval> | null = null;

/** Is the shop's data safe? For the alert bell (owner only). */
export const useBackupHealth = create<Store>()((set, get) => ({
  health: null,
  refresh: () =>
    apiGet<Health>("/api/backups/health").then(
      (health) => set({ health }),
      () => {}, // not the owner / offline: no alert
    ),
  watch: () => {
    if (timer) return;
    void get().refresh();
    timer = setInterval(() => void get().refresh(), 600_000);
  },
}));

/** A copy outside this computer older than this is a problem */
export const OFFSITE_STALE_DAYS = 3;

export type BackupProblem =
  | { kind: "no-offsite" }
  | { kind: "offsite-stale"; days: number | null; error: string | null };

/** null = all good */
export function backupProblem(
  h: Health | null,
  now = Date.now(),
): BackupProblem | null {
  if (!h) return null;
  const o = h.offsite;
  if (!o.folder) return { kind: "no-offsite" };
  const days = o.lastCopyAt ? daysSince(o.lastCopyAt, now) : null;
  if (days === null || days >= OFFSITE_STALE_DAYS)
    return { kind: "offsite-stale", days, error: o.lastError };
  return null;
}
