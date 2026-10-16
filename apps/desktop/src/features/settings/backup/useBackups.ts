import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { apiGet } from "@/lib/api";
import { tr } from "@/lib/i18n";
import { useBackupHealth } from "./useBackupHealth";
import type { BackupsResponse } from "./types";

export const showError = (err: unknown) =>
  toast.error(err instanceof Error ? err.message : tr("Something went wrong"));

/**
 * Backup screen state: the list, the second-copy folder, the data summary
 * — and `run` for any action (one at a time, then everything reloads and
 * the alert bell is told too).
 */
export function useBackups() {
  const [data, setData] = useState<BackupsResponse | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () => apiGet<BackupsResponse>("/api/backups").then(setData, showError),
    [],
  );
  useEffect(() => void load(), [load]);

  const run = useCallback(
    async <T>(fn: () => Promise<T>, done: string | ((result: T) => string)) => {
      setBusy(true);
      try {
        const result = await fn();
        toast.success(tr(typeof done === "string" ? done : done(result)));
        return true;
      } catch (err) {
        showError(err);
        return false;
      } finally {
        await load();
        void useBackupHealth.getState().refresh();
        setBusy(false);
      }
    },
    [load],
  );

  return { data, busy, run };
}
