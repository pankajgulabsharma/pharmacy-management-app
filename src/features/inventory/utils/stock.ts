import { isExpiringWithin, isExpiryPast } from "@/lib/expiry";
import { getExpiringSoonDays } from "@/features/settings/store/useSettingsStore";
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

export function isLowStock(b: InventoryBatch): boolean {
  if (isOutOfStock(b)) return true;
  return b.qtyStrip < b.minStock;
}
