import type { StockMovement } from "../inventory/types";

/**
 * What every counter keeps in memory — so the app stays fast after years
 * of bills. Older data stays safe in the database and is fetched when a
 * screen needs it (reports of a past period, an old bill, batch history).
 */

/** Bills of the last 90 days (+ every udhaar bill, for khata balances) */
export const RECENT_DAYS = 90;

/** Start of the recent window: midnight, 90 days ago */
export function recentSince(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - RECENT_DAYS);
  return d;
}

/**
 * Stock movements kept on counters: purchase receipts only (one per batch
 * received) — needed to check whether a purchase can still be cancelled.
 * Sales movements (the many) are read from the server per batch.
 */
export const COUNTER_MOVEMENT_TYPES = [
  "opening",
  "purchase",
  "purchase_reversal",
] as const satisfies readonly StockMovement["type"][];

export const keptOnCounter = (m: StockMovement): boolean =>
  (COUNTER_MOVEMENT_TYPES as readonly string[]).includes(m.type);
