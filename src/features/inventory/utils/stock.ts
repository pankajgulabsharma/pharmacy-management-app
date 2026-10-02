import type { InventoryBatch } from "../types";

export function parseExpiry(expiry: string): Date | null {
  const parts = expiry.trim().split(/[/-]/).map(Number);
  if (parts.length < 2 || parts.some((n) => Number.isNaN(n))) return null;
  const [dd, mm, yy] = parts;
  const year =
    yy === undefined ? new Date().getFullYear() : yy < 100 ? 2000 + yy : yy;
  const d = new Date(year, mm - 1, dd);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function isExpired(expiry: string, now = new Date()): boolean {
  const d = parseExpiry(expiry);
  if (!d) return false;
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);
  return end < now;
}

export function isExpiringSoon(
  expiry: string,
  days = 90,
  now = new Date(),
): boolean {
  const d = parseExpiry(expiry);
  if (!d) return false;
  if (isExpired(expiry, now)) return false;
  const limit = new Date(now);
  limit.setDate(limit.getDate() + days);
  return d <= limit;
}

export function isOutOfStock(b: InventoryBatch): boolean {
  return b.qtyStrip <= 0 && b.qtyLoose <= 0;
}

export function isLowStock(b: InventoryBatch): boolean {
  if (isOutOfStock(b)) return true;
  return b.qtyStrip < b.minStock;
}
