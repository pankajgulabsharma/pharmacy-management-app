import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { tr } from "@/lib/i18n";
import type {
  Medicine,
  MedicineFormValues,
  MedicineInput,
} from "@medicare/domain/medicines/types";
import { useMedicineStore } from "../store/useMedicineStore";

/** Form strings → typed master input (the store sanitises again) */
export function formToInput(v: MedicineFormValues): MedicineInput {
  return {
    name: v.name,
    salt: v.salt,
    brand: v.brand,
    category: v.category,
    hsn: v.hsn,
    barcode: v.barcode,
    rack: v.rack,
    unit: v.unit,
    unitsPerStrip: Number(v.unitsPerStrip) || 1,
    allowLoose: v.allowLoose,
    mrp: Number(v.mrp) || 0,
    salePrice: Number(v.salePrice) || 0,
    minStock: Number(v.minStock) || 0,
    gstPercent: v.gstPercent,
    schedule: v.schedule,
    status: v.status,
  };
}

/** The server's own message ("Name is required", "still has stock"…) */
export function saveError(err: unknown): string {
  return err instanceof Error ? tr(err.message) : tr("Could not save");
}

/**
 * Saves the medicine form (new or edit). Resolves to the saved medicine,
 * or null when it failed (message shown; the form stays open so nothing
 * typed is lost) or a save is already running (double Enter / click).
 */
export function useSaveMedicine() {
  const addMedicine = useMedicineStore((s) => s.addMedicine);
  const updateMedicine = useMedicineStore((s) => s.updateMedicine);
  const saving = useRef(false);
  return useCallback(
    async (
      values: MedicineFormValues,
      editId: string | null,
    ): Promise<Medicine | null> => {
      if (saving.current) return null;
      saving.current = true;
      try {
        const input = formToInput(values);
        const m = editId
          ? await updateMedicine(editId, input)
          : await addMedicine(input);
        toast.success(editId ? "Medicine updated" : "Medicine added");
        return m;
      } catch (err) {
        toast.error(saveError(err));
        return null;
      } finally {
        saving.current = false;
      }
    },
    [addMedicine, updateMedicine],
  );
}
