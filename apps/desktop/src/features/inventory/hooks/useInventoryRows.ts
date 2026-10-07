import { batchRatePaise } from "@medicare/domain/billing/allocate";
import { useMemo } from "react";
import type { Medicine } from "@medicare/domain/medicines/types";
import { useMedicineStore } from "@/features/medicines/store/useMedicineStore";
import { useInventoryStore } from "../store/useInventoryStore";
import type {
  InventoryBatch,
  StockBatch,
} from "@medicare/domain/inventory/types";

function toRow(b: StockBatch, m: Medicine): InventoryBatch {
  return {
    id: b.id,
    medicineId: m.id,
    medicineName: m.name,
    salt: m.salt,
    brand: m.brand,
    category: m.category,
    hsn: m.hsn,
    batchNo: b.batchNo,
    expiry: b.expiry,
    rack: m.rack,
    unit: m.unit,
    unitsPerStrip: m.unitsPerStrip,
    allowLoose: m.allowLoose,
    qtyStrip: b.qtyStrip,
    qtyLoose: b.qtyLoose,
    mrp: b.mrp,
    purchasePrice: b.purchasePrice,
    // What billing will actually charge: master price, capped at this batch's MRP
    salePrice: batchRatePaise(m, b) / 100,
    minStock: m.minStock,
  };
}

/**
 * Row objects are cached per (batch, medicine) pair. When one batch
 * changes, every other row keeps the same object, so memoized table rows
 * (and InventoryTable's own per-row cache) skip re-rendering.
 */
const rowCache = new WeakMap<
  StockBatch,
  { medicine: Medicine; row: InventoryBatch }
>();

/** Batches joined with their medicine — what the Inventory screen shows */
export function useInventoryRows(): InventoryBatch[] {
  const batches = useInventoryStore((s) => s.batches);
  const medicines = useMedicineStore((s) => s.medicines);

  return useMemo(() => {
    const byId = new Map(medicines.map((m) => [m.id, m]));
    const rows: InventoryBatch[] = [];
    for (const b of batches) {
      const m = byId.get(b.medicineId);
      if (!m) continue; // medicine removed — only possible for empty batches
      const cached = rowCache.get(b);
      if (cached && cached.medicine === m) {
        rows.push(cached.row);
      } else {
        const row = toRow(b, m);
        rowCache.set(b, { medicine: m, row });
        rows.push(row);
      }
    }
    return rows;
  }, [batches, medicines]);
}
