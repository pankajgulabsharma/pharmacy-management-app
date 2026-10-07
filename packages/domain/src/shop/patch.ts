/**
 * What one saved operation changed (a bill, a purchase, a return…).
 * The server sends it back to the counter that asked AND to every other
 * open counter, which merge it — no reloading whole lists.
 */
import type { HeldBill, Sale, SaleReturn } from "../billing/types";
import type { Customer, CustomerPayment } from "../customers/types";
import type { StockBatch, StockMovement } from "../inventory/types";
import type { Purchase, PurchaseReturn } from "../purchases/types";

export type ShopPatch = {
  batches?: StockBatch[];
  movements?: StockMovement[];
  purchases?: Purchase[];
  purchaseReturns?: PurchaseReturn[];
  sales?: Sale[];
  saleReturns?: SaleReturn[];
  held?: HeldBill[];
  heldRemoved?: string[];
  customers?: Customer[];
  customerPayments?: CustomerPayment[];
};

/**
 * Insert-or-replace by id. New records go first (lists are newest first).
 * Merging the same patch twice changes nothing — safe if it arrives twice.
 */
export function upsertById<T extends { id: string }>(list: readonly T[], items: readonly T[] | undefined): T[] {
  if (!items?.length) return list as T[];
  const incoming = new Map(items.map((x) => [x.id, x]));
  const kept = list.map((x) => incoming.get(x.id) ?? x);
  const known = new Set(list.map((x) => x.id));
  return [...items.filter((x) => !known.has(x.id)), ...kept];
}
