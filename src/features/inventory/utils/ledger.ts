/**
 * Stock ledger — pure functions, no React, no store.
 *
 * Every rule about how stock changes lives here so it can be unit-tested
 * and reused unchanged when a backend arrives (same rules, server-side).
 * Inputs are re-validated even if the UI already validated them: stores
 * must never trust their callers.
 */
import { newId } from "@/lib/id";
import { compareExpiry, isValidExpiry } from "@/lib/expiry";
import type { MedicineStock, PackUnit } from "@/features/medicines/types";
import type {
  StockBatch,
  StockMovement,
  StockReceipt,
  StockReceiptLine,
} from "../types";

/** Hard limits — protect against typos (e.g. 40000 instead of 40) and bad data */
export const STOCK_LIMITS = {
  maxQty: 1_000_000,
  maxPrice: 1_000_000,
  batchNoMax: 20,
  maxReceiptLines: 500,
} as const;

const BATCH_RE = /^[A-Z0-9][A-Z0-9\-/]*$/;

export class StockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StockError";
  }
}

function isWholeQty(n: number) {
  return Number.isInteger(n) && n >= 0 && n <= STOCK_LIMITS.maxQty;
}

function isPrice(n: number) {
  return Number.isFinite(n) && n >= 0 && n <= STOCK_LIMITS.maxPrice;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function normalizeBatchNo(batchNo: string) {
  return batchNo.trim().toUpperCase();
}

/** Same medicine + same batch number + same expiry = same physical batch */
function batchKey(medicineId: string, batchNo: string, expiry: string) {
  return `${medicineId}|${normalizeBatchNo(batchNo)}|${expiry.trim()}`;
}

/** LSE medicines are counted in loose units; everything else in packs */
function packsOf(b: Pick<StockBatch, "qtyStrip" | "qtyLoose">, unit: PackUnit) {
  return unit === "LSE" ? b.qtyLoose : b.qtyStrip;
}

function validateLine(
  l: StockReceiptLine,
  known: ReadonlySet<string>,
  i: number,
) {
  const row = `Line ${i + 1}`;
  if (!known.has(l.medicineId))
    throw new StockError(`${row}: unknown medicine`);
  const batch = normalizeBatchNo(l.batchNo);
  if (
    !batch ||
    batch.length > STOCK_LIMITS.batchNoMax ||
    !BATCH_RE.test(batch)
  ) {
    throw new StockError(`${row}: invalid batch number`);
  }
  if (!isValidExpiry(l.expiry))
    throw new StockError(`${row}: expiry must be MM/YY`);
  if (!isWholeQty(l.packs) || l.packs === 0) {
    throw new StockError(`${row}: quantity must be a whole number above 0`);
  }
  if (!isPrice(l.mrp) || l.mrp === 0)
    throw new StockError(`${row}: invalid MRP`);
  if (!isPrice(l.costPerPack)) throw new StockError(`${row}: invalid cost`);
}

/**
 * Adds received goods to stock.
 * - Existing batch (same medicine + batch + expiry) → quantity increases and
 *   the cost becomes the weighted average of old and new stock.
 * - New batch → a new StockBatch is created.
 * Returns new arrays; the inputs are never mutated.
 */
export function applyReceipt(
  batches: readonly StockBatch[],
  receipt: StockReceipt,
  knownMedicineIds: ReadonlySet<string>,
): { batches: StockBatch[]; movements: StockMovement[] } {
  if (receipt.lines.length === 0) throw new StockError("Nothing to receive");
  if (receipt.lines.length > STOCK_LIMITS.maxReceiptLines) {
    throw new StockError("Too many lines in one receipt");
  }
  receipt.lines.forEach((l, i) => validateLine(l, knownMedicineIds, i));

  const at = receipt.at.toISOString();
  const existing = [...batches];
  /** Batches first seen in this receipt — shown at the top of the list */
  const created: StockBatch[] = [];
  const where = new Map<string, { list: StockBatch[]; index: number }>();
  existing.forEach((b, index) =>
    where.set(batchKey(b.medicineId, b.batchNo, b.expiry), {
      list: existing,
      index,
    }),
  );

  const movements: StockMovement[] = [];

  for (const l of receipt.lines) {
    const key = batchKey(l.medicineId, l.batchNo, l.expiry);
    const loose = l.unit === "LSE";
    const stripDelta = loose ? 0 : l.packs;
    const looseDelta = loose ? l.packs : 0;
    const found = where.get(key);

    let batchId: string;
    if (!found) {
      const batch: StockBatch = {
        id: newId("batch"),
        medicineId: l.medicineId,
        batchNo: normalizeBatchNo(l.batchNo),
        expiry: l.expiry.trim(),
        qtyStrip: stripDelta,
        qtyLoose: looseDelta,
        mrp: round2(l.mrp),
        purchasePrice: round2(l.costPerPack),
        receivedAt: at,
      };
      where.set(key, { list: created, index: created.length });
      created.push(batch);
      batchId = batch.id;
    } else {
      const old = found.list[found.index];
      const oldPacks = packsOf(old, l.unit);
      const totalPacks = oldPacks + l.packs;
      const updated: StockBatch = {
        ...old,
        qtyStrip: old.qtyStrip + stripDelta,
        qtyLoose: old.qtyLoose + looseDelta,
        // Latest printed MRP wins; cost is averaged so margins stay honest
        mrp: round2(l.mrp),
        purchasePrice:
          totalPacks > 0
            ? round2(
                (oldPacks * old.purchasePrice + l.packs * l.costPerPack) /
                  totalPacks,
              )
            : round2(l.costPerPack),
      };
      if (
        updated.qtyStrip > STOCK_LIMITS.maxQty ||
        updated.qtyLoose > STOCK_LIMITS.maxQty
      ) {
        throw new StockError(`Batch ${updated.batchNo}: stock limit exceeded`);
      }
      found.list[found.index] = updated;
      batchId = old.id;
    }

    movements.push({
      id: newId("mv"),
      type: "purchase",
      batchId,
      medicineId: l.medicineId,
      qtyStripDelta: stripDelta,
      qtyLooseDelta: looseDelta,
      at,
      refId: receipt.refId,
      note: receipt.note,
    });
  }

  return { batches: [...created.reverse(), ...existing], movements };
}

/**
 * Sets a batch to a counted quantity (physical count, damage, disposal…).
 * Returns null when nothing changed, so no empty movement is logged.
 */
export function applyAdjustment(
  batch: StockBatch,
  target: { qtyStrip: number; qtyLoose: number },
  reason: string,
  now: Date,
): { batch: StockBatch; movement: StockMovement } | null {
  if (!isWholeQty(target.qtyStrip) || !isWholeQty(target.qtyLoose)) {
    throw new StockError("Quantities must be whole numbers");
  }
  const stripDelta = target.qtyStrip - batch.qtyStrip;
  const looseDelta = target.qtyLoose - batch.qtyLoose;
  if (stripDelta === 0 && looseDelta === 0) return null;

  return {
    batch: { ...batch, qtyStrip: target.qtyStrip, qtyLoose: target.qtyLoose },
    movement: {
      id: newId("mv"),
      type: "adjustment",
      batchId: batch.id,
      medicineId: batch.medicineId,
      qtyStripDelta: stripDelta,
      qtyLooseDelta: looseDelta,
      at: now.toISOString(),
      note: reason.trim().slice(0, 120) || "Stock adjustment",
    },
  };
}

/** Opening-stock movements so the log explains the initial quantities */
export function openingMovements(
  batches: readonly StockBatch[],
): StockMovement[] {
  return batches.map((b) => ({
    id: `mv_open_${b.id}`,
    type: "opening",
    batchId: b.id,
    medicineId: b.medicineId,
    qtyStripDelta: b.qtyStrip,
    qtyLooseDelta: b.qtyLoose,
    at: b.receivedAt,
    note: "Opening stock",
  }));
}

/** Per-medicine totals + nearest expiry, in one pass over all batches */
export function summarizeStock(
  batches: readonly StockBatch[],
): Map<string, MedicineStock> {
  const map = new Map<string, MedicineStock>();
  for (const b of batches) {
    const hasStock = b.qtyStrip > 0 || b.qtyLoose > 0;
    const s = map.get(b.medicineId) ?? {
      stockStrip: 0,
      stockLoose: 0,
      nearestExpiry: null,
      batchCount: 0,
    };
    s.stockStrip += b.qtyStrip;
    s.stockLoose += b.qtyLoose;
    if (hasStock) {
      s.batchCount += 1;
      if (
        s.nearestExpiry === null ||
        compareExpiry(b.expiry, s.nearestExpiry) < 0
      ) {
        s.nearestExpiry = b.expiry;
      }
    }
    map.set(b.medicineId, s);
  }
  return map;
}
