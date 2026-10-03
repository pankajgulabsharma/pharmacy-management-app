import type { StockReceipt } from "@/features/inventory/types";
import type { Purchase } from "../types";
import { calcLine } from "./calc";

/**
 * Converts a purchase invoice into a goods-received note for inventory.
 * Free (scheme) packs are added to stock; the landed cost spreads the
 * invoice amount over billed + free packs.
 */
export function purchaseToStockReceipt(p: Purchase): StockReceipt {
  return {
    refId: p.id,
    note: `Purchase ${p.invoiceNo} · ${p.supplierName}`,
    at: new Date(p.createdAt),
    lines: p.lines.map((l) => ({
      medicineId: l.medicineId,
      unit: l.unit,
      batchNo: l.batchNo,
      expiry: l.expiry,
      packs: l.qty + l.freeQty,
      mrp: l.mrpPaise / 100,
      costPerPack: calcLine(l).landedPerPackPaise / 100,
    })),
  };
}
