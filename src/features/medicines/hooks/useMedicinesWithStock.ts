import { useMemo } from "react";
import { useInventoryStore } from "@/features/inventory/store/useInventoryStore";
import { summarizeStock } from "@/features/inventory/utils/ledger";
import { useMedicineStore } from "../store/useMedicineStore";
import { EMPTY_STOCK, type MedicineWithStock } from "../types";

/**
 * Medicine master joined with live stock from inventory batches.
 * Recomputed only when medicines or batches change.
 */
export function useMedicinesWithStock(): MedicineWithStock[] {
  const medicines = useMedicineStore((s) => s.medicines);
  const batches = useInventoryStore((s) => s.batches);

  return useMemo(() => {
    const stock = summarizeStock(batches);
    return medicines.map((m) => ({
      ...m,
      ...(stock.get(m.id) ?? EMPTY_STOCK),
    }));
  }, [medicines, batches]);
}
