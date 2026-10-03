import { isExpiringWithin, isExpiryPast } from "@/lib/expiry";
import type { InventoryBatch } from "../types";

/** Batches expiring within this window are flagged "Expiring soon" */
export const EXPIRING_SOON_DAYS = 90;

/**
 * Expiry is "MM/YY" (as printed on packs) and is valid until the last day
 * of that month. Parsing lives in lib/expiry so every feature agrees.
 */
export function isExpired(expiry: string, now = new Date()): boolean {
  return isExpiryPast(expiry, now);
}

export function isExpiringSoon(
  expiry: string,
  days = EXPIRING_SOON_DAYS,
  now = new Date(),
): boolean {
  return isExpiringWithin(expiry, days, now);
}

export function isOutOfStock(b: InventoryBatch): boolean {
  return b.qtyStrip <= 0 && b.qtyLoose <= 0;
}

export function isLowStock(b: InventoryBatch): boolean {
  if (isOutOfStock(b)) return true;
  return b.qtyStrip < b.minStock;
}
