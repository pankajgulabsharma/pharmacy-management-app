import type { Purchase, PurchaseReturn } from "./types";

function normalize(s: string) {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

/** Searchable text per purchase — built once per (immutable) purchase object */
const haystackCache = new WeakMap<Purchase, string>();

function haystackFor(p: Purchase): string {
  let hay = haystackCache.get(p);
  if (hay === undefined) {
    hay = normalize(
      [
        p.invoiceNo,
        p.supplierName,
        p.supplierGstin,
        p.invoiceDate,
        p.notes,
        ...p.lines.flatMap((l) => [l.medicineName, l.brand, l.batchNo]),
      ].join(" "),
    );
    haystackCache.set(p, hay);
  }
  return hay;
}

/** Every token must appear (invoice, supplier, GSTIN, medicine, batch…) */
export function purchaseMatchesQuery(p: Purchase, query: string): boolean {
  const q = normalize(query);
  if (!q) return true;
  const hay = haystackFor(p);
  return q.split(" ").every((token) => hay.includes(token));
}

const returnCache = new WeakMap<PurchaseReturn, string>();

/** Debit note search: number, supplier, invoice, medicine, batch */
export function returnMatchesQuery(r: PurchaseReturn, query: string): boolean {
  const q = normalize(query);
  if (!q) return true;
  let hay = returnCache.get(r);
  if (hay === undefined) {
    hay = normalize(
      [
        r.returnNo,
        r.supplierName,
        r.supplierGstin,
        r.invoiceNo,
        r.notes,
        ...r.lines.flatMap((l) => [l.medicineName, l.batchNo]),
      ].join(" "),
    );
    returnCache.set(r, hay);
  }
  return q.split(" ").every((t) => hay.includes(t));
}
