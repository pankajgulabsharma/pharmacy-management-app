/**
 * Stock count (physical stock taking), rack by rack:
 *
 *   start  → the batches of the chosen racks are listed with what the
 *            app says is there (a snapshot)
 *   count  → staff type what is really on the shelf (several people,
 *            several counters, any order; a paper sheet can be printed)
 *   review → short / excess per batch, valued at cost
 *   post   → every difference becomes a stock adjustment ("Stock count
 *            SC-0003"), the count is kept in the history
 *
 * Bills made while counting don't spoil the count: what is posted is the
 * DIFFERENCE found (counted − snapshot), added to the stock as it is now.
 */
import type { Paise } from "../lib/money";
import { rupeesToPaise } from "../lib/money";
import type { StockBatch } from "./types";

export type StockCountStatus = "open" | "posted" | "cancelled";

/** Rack name for medicines without one */
export const NO_RACK = "";

export type StockCount = {
  id: string;
  /** "SC-0003" */
  countNo: string;
  /** Racks counted ([] = the whole shop) */
  racks: string[];
  status: StockCountStatus;
  note: string;
  createdAt: string;
  createdBy: string;
  postedAt: string | null;
  postedBy: string;
  /** Filled when posted (kept for the history) */
  summary: CountSummary | null;
};

export type StockCountLine = {
  countId: string;
  batchId: string;
  medicineId: string;
  /** What the app said at the start */
  systemStrip: number;
  systemLoose: number;
  /** What was found; null = not counted yet */
  countedStrip: number | null;
  countedLoose: number | null;
  countedBy: string;
  countedAt: string | null;
};

export type PackInfo = { unit: string; unitsPerStrip: number };

/** Strips + loose → loose units (LSE medicines are units already) */
export function toUnits(strip: number, loose: number, p: PackInfo): number {
  if (p.unit === "LSE") return loose;
  return strip * Math.max(1, p.unitsPerStrip) + loose;
}

/** Loose units → strips + loose */
export function fromUnits(units: number, p: PackInfo) {
  if (p.unit === "LSE") return { qtyStrip: 0, qtyLoose: units };
  const ups = Math.max(1, p.unitsPerStrip);
  return { qtyStrip: Math.floor(units / ups), qtyLoose: units % ups };
}

export const isCounted = (l: StockCountLine) => l.countedStrip !== null;

/** counted − system, in loose units (0 when not counted) */
export function lineDiffUnits(l: StockCountLine, p: PackInfo): number {
  if (!isCounted(l)) return 0;
  return (
    toUnits(l.countedStrip ?? 0, l.countedLoose ?? 0, p) -
    toUnits(l.systemStrip, l.systemLoose, p)
  );
}

/** Value of a difference at landed cost (purchase price is per pack) */
export function diffValuePaise(
  units: number,
  purchasePricePerPack: number,
  p: PackInfo,
): Paise {
  const perUnit =
    p.unit === "LSE"
      ? purchasePricePerPack
      : purchasePricePerPack / Math.max(1, p.unitsPerStrip);
  return Math.round(units * rupeesToPaise(perUnit));
}

/**
 * The quantity to set when posting: today's stock + the difference found.
 * Throws when that would go below zero (counted, then sold more than was
 * there) — the line must be counted again.
 */
export function postTarget(
  current: Pick<StockBatch, "qtyStrip" | "qtyLoose">,
  line: StockCountLine,
  p: PackInfo,
) {
  const units =
    toUnits(current.qtyStrip, current.qtyLoose, p) + lineDiffUnits(line, p);
  if (units < 0) return null;
  return fromUnits(units, p);
}

export type CountSummary = {
  lines: number;
  counted: number;
  matched: number;
  short: number;
  excess: number;
  shortValuePaise: Paise;
  excessValuePaise: Paise;
};

export function summarizeCount(
  lines: readonly StockCountLine[],
  packOf: (medicineId: string) => PackInfo | undefined,
  costOf: (batchId: string) => number,
): CountSummary {
  const s: CountSummary = {
    lines: lines.length,
    counted: 0,
    matched: 0,
    short: 0,
    excess: 0,
    shortValuePaise: 0,
    excessValuePaise: 0,
  };
  for (const l of lines) {
    if (!isCounted(l)) continue;
    s.counted += 1;
    const p = packOf(l.medicineId) ?? { unit: "STP", unitsPerStrip: 1 };
    const d = lineDiffUnits(l, p);
    if (d === 0) s.matched += 1;
    else if (d < 0) {
      s.short += 1;
      s.shortValuePaise += -diffValuePaise(d, costOf(l.batchId), p);
    } else {
      s.excess += 1;
      s.excessValuePaise += diffValuePaise(d, costOf(l.batchId), p);
    }
  }
  return s;
}

/** "SC-0003" */
export const countNo = (n: number) => `SC-${String(n).padStart(4, "0")}`;

/** Rack labels: "" reads "No rack" */
export const rackLabel = (rack: string) => rack.trim() || "No rack";
