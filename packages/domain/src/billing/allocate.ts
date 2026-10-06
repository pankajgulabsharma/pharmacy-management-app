/**
 * FEFO allocation — which batches a sale line is taken from.
 * Pure functions: no React, no store.
 */
import type { StockBatch } from "../inventory/types";
import { canSellLoose, type Medicine } from "../medicines/types";
import { compareExpiry, isExpiryPast } from "../lib/expiry";
import { rupeesToPaise } from "../lib/money";
import type { BatchAllocation } from "./types";

/** Units per pack, never 0 */
export function unitsPerPack(m: Pick<Medicine, "unitsPerStrip">) {
  return m.unitsPerStrip > 0 ? m.unitsPerStrip : 1;
}

/** Can this medicine be sold in loose units at all? */
export function sellsLoose(m: Pick<Medicine, "unit" | "allowLoose">) {
  return canSellLoose(m.unit, m.allowLoose);
}

/**
 * Selling price per pack for a batch: the master sale price, but never
 * above this batch's printed MRP (selling above MRP is illegal).
 */
export function batchRatePaise(
  m: Pick<Medicine, "salePrice">,
  b: Pick<StockBatch, "mrp">,
) {
  return Math.min(rupeesToPaise(m.salePrice), rupeesToPaise(b.mrp));
}

/** Batches that may be sold: not expired, has stock — earliest expiry first */
export function sellableBatches(
  batches: readonly StockBatch[],
  medicineId: string,
  now: Date,
): StockBatch[] {
  return batches
    .filter(
      (b) =>
        b.medicineId === medicineId &&
        (b.qtyStrip > 0 || b.qtyLoose > 0) &&
        !isExpiryPast(b.expiry, now),
    )
    .sort(
      (a, b) =>
        compareExpiry(a.expiry, b.expiry) ||
        a.receivedAt.localeCompare(b.receivedAt),
    );
}

export type StockLimits = {
  /** Max whole packs that can be sold */
  maxStrip: number;
  /** Max loose units, given `qtyStrip` packs are also being sold */
  maxLoose: number;
};

/** Upper limits for the quantity controls, from sellable batches */
export function stockLimits(
  sellable: readonly StockBatch[],
  m: Pick<Medicine, "unit" | "allowLoose" | "unitsPerStrip">,
  qtyStrip: number,
): StockLimits {
  const ups = unitsPerPack(m);
  let strips = 0;
  let loose = 0;
  for (const b of sellable) {
    strips += b.qtyStrip;
    loose += b.qtyLoose;
  }
  if (m.unit === "LSE") return { maxStrip: 0, maxLoose: loose };
  if (!sellsLoose(m)) return { maxStrip: strips, maxLoose: 0 };
  // Loose can also come from strips that are not being sold whole
  return {
    maxStrip: strips,
    maxLoose: loose + Math.max(0, strips - qtyStrip) * ups,
  };
}

export type Allocation = {
  allocations: BatchAllocation[];
  /** Packs / loose units that could not be found in stock */
  shortStrip: number;
  shortLoose: number;
};

/**
 * Takes stock earliest-expiry first.
 * 1) Whole packs from each batch in FEFO order.
 * 2) Loose units: first existing loose stock, then by opening strips
 *    that were not sold whole — again in FEFO order.
 */
export function allocateFefo(
  sellable: readonly StockBatch[],
  m: Pick<Medicine, "unit" | "allowLoose" | "unitsPerStrip" | "salePrice">,
  qtyStrip: number,
  qtyLoose: number,
): Allocation {
  const ups = unitsPerPack(m);
  const loosePossible = m.unit === "LSE" || sellsLoose(m);
  const parts = sellable.map((b) => ({ b, strip: 0, loose: 0, broken: 0 }));

  // 1) whole packs
  let needStrip = m.unit === "LSE" ? 0 : qtyStrip;
  for (const p of parts) {
    if (needStrip === 0) break;
    const take = Math.min(needStrip, p.b.qtyStrip);
    p.strip = take;
    needStrip -= take;
  }

  // 2) loose units
  let needLoose = loosePossible ? qtyLoose : 0;
  for (const p of parts) {
    if (needLoose === 0) break;
    const fromLoose = Math.min(needLoose, p.b.qtyLoose);
    p.loose += fromLoose;
    needLoose -= fromLoose;
    if (needLoose === 0 || m.unit === "LSE") continue;

    const spareStrips = p.b.qtyStrip - p.strip;
    const toBreak = Math.min(spareStrips, Math.ceil(needLoose / ups));
    if (toBreak > 0) {
      const take = Math.min(needLoose, toBreak * ups);
      p.broken = toBreak;
      p.loose += take;
      needLoose -= take;
    }
  }

  const allocations: BatchAllocation[] = parts
    .filter((p) => p.strip > 0 || p.loose > 0)
    .map((p) => ({
      batchId: p.b.id,
      batchNo: p.b.batchNo,
      expiry: p.b.expiry,
      qtyStrip: p.strip,
      qtyLoose: p.loose,
      breakStrips: p.broken,
      ratePaise: batchRatePaise(m, p.b),
      mrpPaise: rupeesToPaise(p.b.mrp),
      costPaise: rupeesToPaise(p.b.purchasePrice),
    }));

  return {
    allocations,
    shortStrip: needStrip,
    shortLoose: loosePossible ? needLoose : qtyLoose,
  };
}

/** Stock movement for one allocation (negative = goes out) */
export function allocationDelta(a: BatchAllocation, ups: number) {
  return {
    batchId: a.batchId,
    qtyStripDelta: -(a.qtyStrip + a.breakStrips),
    qtyLooseDelta: a.breakStrips * ups - a.qtyLoose,
  };
}
