import { useCallback } from "react";
import { toast } from "sonner";
import { tr } from "@/lib/i18n";
import { useMedicineStore } from "../store/useMedicineStore";
import { saveError } from "./useSaveMedicine";

/** Undoes one import and says how it went (Recent imports list, import toast) */
export function useUndoImport(onDone?: () => void) {
  const undoImport = useMedicineStore((s) => s.undoImport);
  return useCallback(
    async (id: string) => {
      try {
        const r = await undoImport(id);
        toast.success(tr("Import undone"), {
          description: tr("{{n}} new medicines and their stock removed", {
            n: r.removed,
          }),
        });
        onDone?.();
      } catch (err) {
        toast.error(tr("Could not undo the import"), {
          description: saveError(err),
        });
      }
    },
    [undoImport, onDone],
  );
}
