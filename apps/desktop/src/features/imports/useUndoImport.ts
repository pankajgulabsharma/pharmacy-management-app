import { useCallback } from "react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { tr } from "@/lib/i18n";
import { applyShopPatch } from "@/stores/applyShopPatch";
import type { ShopPatch } from "@medicare/domain/shop/patch";
import { useMedicineStore } from "@/features/medicines/store/useMedicineStore";
import { useSupplierStore } from "@/features/suppliers/store/useSupplierStore";

/** What was imported: medicines (+ opening stock), customers or suppliers */
export type ImportKind = "medicines" | "customers" | "suppliers";

const DONE: Record<ImportKind, [one: string, many: string]> = {
  medicines: [
    "1 new medicine and its stock removed",
    "{{n}} new medicines and their stock removed",
  ],
  customers: [
    "1 customer and the old udhaar removed",
    "{{n}} customers and their old udhaar removed",
  ],
  suppliers: [
    "1 supplier and the old dues removed",
    "{{n}} suppliers and their old dues removed",
  ],
};

async function undo(kind: ImportKind, id: string): Promise<number> {
  if (kind === "medicines")
    return (await useMedicineStore.getState().undoImport(id)).removed;
  const r = await apiRequest<{ removed: number; patch: ShopPatch }>(
    "POST",
    `/api/${kind}/imports/${encodeURIComponent(id)}/undo`,
    undefined,
    60_000,
  );
  applyShopPatch(r.patch); // customers / old dues gone at once
  if (kind === "suppliers") await useSupplierStore.getState().loadFromServer();
  return r.removed;
}

/** Undoes one import and says how it went (Recent imports list, import toast) */
export function useUndoImport(kind: ImportKind, onDone?: () => void) {
  return useCallback(
    async (id: string) => {
      try {
        const n = await undo(kind, id);
        toast.success(tr("Import undone"), {
          description: tr(DONE[kind][n === 1 ? 0 : 1], { n }),
        });
        onDone?.();
      } catch (err) {
        toast.error(tr("Could not undo the import"), {
          description: err instanceof Error ? tr(err.message) : undefined,
        });
      }
    },
    [kind, onDone],
  );
}
