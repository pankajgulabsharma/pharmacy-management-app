import type { StockBatch } from "@/features/inventory/types";
import { batchKey } from "@/features/inventory/utils/ledger";
import { newId } from "@/lib/id";
import { cleanText } from "@/lib/sanitize";
import {
  RETURN_REASONS,
  type Purchase,
  type PurchaseLine,
  type PurchaseReturn,
  type PurchaseReturnInput,
  type PurchaseReturnLine,
} from "../types";
import { calcLine } from "./calc";

export class ReturnError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReturnError";
  }
}

export const RETURN_NOTES_MAX = 300;

/** Packs of each invoice line already returned, across all debit notes */
export function returnedQtyByLine(
  returns: readonly PurchaseReturn[],
  purchaseId: string,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of returns) {
    if (r.purchaseId !== purchaseId) continue;
    for (const l of r.lines) {
      map.set(l.purchaseLineId, (map.get(l.purchaseLineId) ?? 0) + l.qty);
    }
  }
  return map;
}

export type ReturnableLine = {
  line: PurchaseLine;
  /** Billed + free packs on the invoice */
  purchased: number;
  alreadyReturned: number;
  /** Current stock of the matching batch (0 if the batch is gone) */
  inStock: number;
  batchId: string | null;
  /** min(purchased − returned, inStock) */
  max: number;
  /** Credit per pack (landed cost incl. GST) */
  ratePaise: number;
};

/** Per-line limits for a return — shared by the form (to guide) and the store (to enforce) */
export function getReturnableLines(
  purchase: Purchase,
  returns: readonly PurchaseReturn[],
  batches: readonly StockBatch[],
): ReturnableLine[] {
  const returned = returnedQtyByLine(returns, purchase.id);
  const byKey = new Map(
    batches.map((b) => [batchKey(b.medicineId, b.batchNo, b.expiry), b]),
  );

  return purchase.lines.map((line) => {
    const batch =
      byKey.get(batchKey(line.medicineId, line.batchNo, line.expiry)) ?? null;
    const purchased = line.qty + line.freeQty;
    const alreadyReturned = returned.get(line.id) ?? 0;
    const inStock = batch
      ? line.unit === "LSE"
        ? batch.qtyLoose
        : batch.qtyStrip
      : 0;
    return {
      line,
      purchased,
      alreadyReturned,
      inStock,
      batchId: batch?.id ?? null,
      max: Math.max(0, Math.min(purchased - alreadyReturned, inStock)),
      ratePaise: calcLine(line).landedPerPackPaise,
    };
  });
}

/** "DN-0001", "DN-0002", … — next number after the highest existing one */
export function nextReturnNo(returns: readonly PurchaseReturn[]): string {
  let max = 0;
  for (const r of returns) {
    const n = Number(/^DN-(\d+)$/.exec(r.returnNo)?.[1] ?? 0);
    if (n > max) max = n;
  }
  return `DN-${String(max + 1).padStart(4, "0")}`;
}

/**
 * Builds a debit note from the form input after checking every limit.
 * Pure: the caller applies the stock issue and stores the result.
 */
export function buildPurchaseReturn(
  purchase: Purchase,
  input: PurchaseReturnInput,
  returnable: readonly ReturnableLine[],
  returnNo: string,
  now: Date,
): {
  ret: PurchaseReturn;
  issue: { batchId: string; unit: PurchaseLine["unit"]; packs: number }[];
} {
  if (!(input.reason in RETURN_REASONS))
    throw new ReturnError("Choose a reason");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date))
    throw new ReturnError("Invalid date");

  const byLineId = new Map(returnable.map((r) => [r.line.id, r]));
  const seen = new Set<string>();
  const lines: PurchaseReturnLine[] = [];
  const issue: {
    batchId: string;
    unit: PurchaseLine["unit"];
    packs: number;
  }[] = [];

  for (const l of input.lines) {
    if (l.qty === 0) continue;
    if (seen.has(l.purchaseLineId))
      throw new ReturnError("Same item listed twice");
    seen.add(l.purchaseLineId);

    const r = byLineId.get(l.purchaseLineId);
    if (!r) throw new ReturnError("Item is not on this invoice");
    if (!Number.isInteger(l.qty) || l.qty < 0) {
      throw new ReturnError(
        `${r.line.medicineName}: quantity must be a whole number`,
      );
    }
    if (l.qty > r.max || !r.batchId) {
      throw new ReturnError(
        `${r.line.medicineName}: you can return at most ${r.max}`,
      );
    }

    const amountPaise = l.qty * r.ratePaise;
    const g = r.line.gstPercent;
    lines.push({
      id: newId("rl"),
      purchaseLineId: r.line.id,
      medicineId: r.line.medicineId,
      medicineName: r.line.medicineName,
      brand: r.line.brand,
      unit: r.line.unit,
      unitsPerStrip: r.line.unitsPerStrip,
      batchNo: r.line.batchNo,
      expiry: r.line.expiry,
      qty: l.qty,
      ratePaise: r.ratePaise,
      gstPercent: g,
      amountPaise,
      gstPaise: Math.round((amountPaise * g) / (100 + g)),
    });
    issue.push({ batchId: r.batchId, unit: r.line.unit, packs: l.qty });
  }

  if (lines.length === 0)
    throw new ReturnError("Enter a quantity for at least one item");

  return {
    ret: {
      id: newId("ret"),
      returnNo,
      purchaseId: purchase.id,
      invoiceNo: purchase.invoiceNo,
      supplierId: purchase.supplierId,
      supplierName: purchase.supplierName,
      supplierGstin: purchase.supplierGstin,
      date: input.date,
      reason: input.reason,
      notes: cleanText(input.notes, RETURN_NOTES_MAX),
      lines,
      totalQty: lines.reduce((s, l) => s + l.qty, 0),
      totalPaise: lines.reduce((s, l) => s + l.amountPaise, 0),
      gstPaise: lines.reduce((s, l) => s + l.gstPaise, 0),
      createdAt: now.toISOString(),
    },
    issue,
  };
}
