import { isExpiringWithin, isExpiryPast } from "@/lib/expiry";
import { getExpiringSoonDays } from "@/features/settings/store/useSettingsStore";
import { rupeesToPaise, type Paise } from "@/lib/money";
import type { InventoryBatch } from "../types";

/**
 * Expiry is "MM/YY" (as printed on packs) and is valid until the last day
 * of that month. Parsing lives in lib/expiry so every feature agrees.
 */
export function isExpired(expiry: string, now = new Date()): boolean {
  return isExpiryPast(expiry, now);
}

export function isExpiringSoon(
  expiry: string,
  /** Defaults to Settings → Inventory → "Expiring soon" window */
  days = getExpiringSoonDays(),
  now = new Date(),
): boolean {
  return isExpiringWithin(expiry, days, now);
}

export function isOutOfStock(b: InventoryBatch): boolean {
  return b.qtyStrip <= 0 && b.qtyLoose <= 0;
}

/* ------------------------------------------------------------------ */
/* ONE status per batch — used by the row badge, the filter chips and   */
/* the counts, so they can never disagree.                               */
/* ------------------------------------------------------------------ */

export type BatchStatus = "ok" | "low" | "out" | "expiring" | "expired";

/** Packs for normal medicines, units for loose-only (LSE) ones */
const shelfQty = (b: Pick<InventoryBatch, "unit" | "qtyStrip" | "qtyLoose">) =>
  b.unit === "LSE" ? b.qtyLoose : b.qtyStrip;

/**
 * Sellable stock per MEDICINE (all its non-expired batches together).
 * "Low stock" is about the medicine, not one batch: Dolo with batches of
 * 5 + 280 strips is not low just because one batch is small.
 */
export function sellableTotals(
  batches: readonly InventoryBatch[],
  now = new Date(),
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const b of batches) {
    if (isExpired(b.expiry, now)) continue;
    totals.set(b.medicineId, (totals.get(b.medicineId) ?? 0) + shelfQty(b));
  }
  return totals;
}

/**
 * Exactly one status, in this order of priority:
 *   out       nothing left in this batch
 *   expired   has stock but can't be sold
 *   expiring  sell first / return in time (Settings → expiry window)
 *   low       the medicine's total sellable stock is below its minimum
 *   ok        in stock, nothing to do
 */
export function batchStatus(
  b: InventoryBatch,
  totals: ReadonlyMap<string, number>,
  now = new Date(),
  expiringDays = getExpiringSoonDays(),
): BatchStatus {
  if (isOutOfStock(b)) return "out";
  if (isExpired(b.expiry, now)) return "expired";
  if (isExpiringSoon(b.expiry, expiringDays, now)) return "expiring";
  if ((totals.get(b.medicineId) ?? 0) < b.minStock) return "low";
  return "ok";
}

/** Status for every batch, keyed by batch id */
export function batchStatuses(
  batches: readonly InventoryBatch[],
  now = new Date(),
  expiringDays = getExpiringSoonDays(),
): Map<string, BatchStatus> {
  const totals = sellableTotals(batches, now);
  return new Map(
    batches.map((b) => [b.id, batchStatus(b, totals, now, expiringDays)]),
  );
}

/* ------------------------------------------------------------------ */
/* Valuation — one definition for Inventory, Reports and CSV exports   */
/* ------------------------------------------------------------------ */

type ValuedBatch = {
  qtyStrip: number;
  qtyLoose: number;
  purchasePrice: number;
  mrp: number;
};
type PackInfo = { unit: string; unitsPerStrip: number };

/** Stock in packs (loose units count as a fraction of a pack; LSE = units) */
export function batchPacks(
  b: Pick<ValuedBatch, "qtyStrip" | "qtyLoose">,
  m: PackInfo,
): number {
  if (m.unit === "LSE") return b.qtyLoose;
  const ups = m.unitsPerStrip > 0 ? m.unitsPerStrip : 1;
  return b.qtyStrip + b.qtyLoose / ups;
}

/** Value of a batch at landed cost, in paise */
export function batchCostPaise(b: ValuedBatch, m: PackInfo): Paise {
  return Math.round(batchPacks(b, m) * rupeesToPaise(b.purchasePrice));
}

/** Value of a batch at MRP, in paise */
export function batchMrpPaise(b: ValuedBatch, m: PackInfo): Paise {
  return Math.round(batchPacks(b, m) * rupeesToPaise(b.mrp));
}
