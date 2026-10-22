/**
 * Expiry return to the supplier — the month-end job of every chemist:
 *
 *   1. find stock that has expired, or expires in the next few months
 *   2. trace each batch back to the invoice (and so the supplier) it came on
 *   3. return it supplier by supplier, in one go — one debit note per
 *      invoice (that is how the distributor matches the credit)
 *
 * Stock that no invoice in the app explains (opening stock, imported
 * stock) can't go back on a debit note; expired, it can be written off.
 */
import type { Medicine } from "../medicines/types";
import type { StockBatch } from "../inventory/types";
import { batchKey } from "../inventory/ledger";
import { expiryEndDate, isExpiryPast, isExpiringWithin } from "../lib/expiry";
import type { Paise } from "../lib/money";
import { calcLine } from "./calc";
import { getReturnableLines } from "./returns";
import { canReturnPurchase } from "./rules";
import type { Purchase, PurchaseReturn, ReturnReason } from "./types";

export type ExpiryState = "expired" | "near";

export type ExpirySource = {
  purchaseId: string;
  purchaseLineId: string;
  invoiceNo: string;
  invoiceDate: string;
  supplierId: string;
  supplierName: string;
  /** Credit per pack (landed cost incl. GST, as on the invoice) */
  ratePaise: Paise;
  gstPercent: number;
};

export type ExpiryItem = {
  /** batchId + purchaseLineId — unique per row */
  key: string;
  batchId: string;
  medicineId: string;
  medicineName: string;
  brand: string;
  unit: string;
  batchNo: string;
  expiry: string;
  state: ExpiryState;
  /** Days to the end of the expiry month (negative = expired that long ago) */
  daysLeft: number;
  /** Packs this row can send back (whole packs; LSE = units) */
  packs: number;
  /** Loose tablets of an opened strip — can't go on a debit note */
  loose: number;
  /** null = no invoice in the app explains this stock */
  source: ExpirySource | null;
  /** packs × rate */
  creditPaise: Paise;
};

export type SupplierExpiryGroup = {
  supplierId: string;
  supplierName: string;
  items: ExpiryItem[];
  packs: number;
  creditPaise: Paise;
  /** Invoices (= debit notes) the return will make */
  invoices: number;
};

const DAY = 86_400_000;

/**
 * Everything in stock that is expired or expires within `nearDays`,
 * split over the invoices it came on (newest invoice first — that's the
 * stock still on the shelf).
 */
export function expiryItems(
  batches: readonly StockBatch[],
  medicines: readonly Medicine[],
  purchases: readonly Purchase[],
  returns: readonly PurchaseReturn[],
  opts: { nearDays: number },
  now = new Date(),
): ExpiryItem[] {
  const meds = new Map(medicines.map((m) => [m.id, m]));
  const due = batches.filter(
    (b) =>
      (b.qtyStrip > 0 || b.qtyLoose > 0) &&
      (isExpiryPast(b.expiry, now) ||
        isExpiringWithin(b.expiry, opts.nearDays, now)),
  );
  if (!due.length) return [];

  // Invoice lines per batch (only invoices a debit note can be made on)
  const wanted = new Set(
    due.map((b) => batchKey(b.medicineId, b.batchNo, b.expiry)),
  );
  const sources = new Map<
    string,
    { p: Purchase; lineId: string; max: number; rate: Paise; gst: number }[]
  >();
  for (const p of purchases) {
    if (!canReturnPurchase(p).allowed) continue;
    if (
      !p.lines.some((l) =>
        wanted.has(batchKey(l.medicineId, l.batchNo, l.expiry)),
      )
    )
      continue;
    for (const r of getReturnableLines(p, returns, due)) {
      const k = batchKey(r.line.medicineId, r.line.batchNo, r.line.expiry);
      if (!wanted.has(k) || r.max <= 0) continue;
      const list = sources.get(k) ?? [];
      list.push({
        p,
        lineId: r.line.id,
        max: r.purchased - r.alreadyReturned,
        rate: calcLine(r.line).landedPerPackPaise,
        gst: r.line.gstPercent,
      });
      sources.set(k, list);
    }
  }

  const out: ExpiryItem[] = [];
  for (const b of due) {
    const m = meds.get(b.medicineId);
    if (!m) continue;
    const lse = m.unit === "LSE";
    let left = lse ? b.qtyLoose : b.qtyStrip;
    const end = expiryEndDate(b.expiry);
    const base = {
      batchId: b.id,
      medicineId: m.id,
      medicineName: m.name,
      brand: m.brand,
      unit: m.unit,
      batchNo: b.batchNo,
      expiry: b.expiry,
      state: (isExpiryPast(b.expiry, now) ? "expired" : "near") as ExpiryState,
      daysLeft: end ? Math.floor((end.getTime() - now.getTime()) / DAY) : 0,
    };
    const list = (sources.get(batchKey(m.id, b.batchNo, b.expiry)) ?? []).sort(
      (x, y) =>
        y.p.invoiceDate.localeCompare(x.p.invoiceDate) ||
        y.p.createdAt.localeCompare(x.p.createdAt),
    );
    let first = true;
    for (const s of list) {
      if (left <= 0) break;
      const packs = Math.min(left, s.max);
      if (packs <= 0) continue;
      left -= packs;
      out.push({
        ...base,
        key: `${b.id}:${s.lineId}`,
        packs,
        loose: first && !lse ? b.qtyLoose : 0,
        source: {
          purchaseId: s.p.id,
          purchaseLineId: s.lineId,
          invoiceNo: s.p.invoiceNo,
          invoiceDate: s.p.invoiceDate,
          supplierId: s.p.supplierId,
          supplierName: s.p.supplierName,
          ratePaise: s.rate,
          gstPercent: s.gst,
        },
        creditPaise: packs * s.rate,
      });
      first = false;
    }
    // What no invoice explains
    if (left > 0 || (first && b.qtyLoose > 0 && !lse))
      out.push({
        ...base,
        key: `${b.id}:-`,
        packs: Math.max(0, left),
        loose: first && !lse ? b.qtyLoose : 0,
        source: null,
        creditPaise: 0,
      });
  }
  return out.sort(
    (a, b) =>
      a.daysLeft - b.daysLeft || a.medicineName.localeCompare(b.medicineName),
  );
}

/** Supplier by supplier, most credit first; the unexplained stock apart */
export function groupBySupplier(items: readonly ExpiryItem[]): {
  groups: SupplierExpiryGroup[];
  noInvoice: ExpiryItem[];
} {
  const map = new Map<string, SupplierExpiryGroup>();
  const noInvoice: ExpiryItem[] = [];
  for (const it of items) {
    if (!it.source) {
      noInvoice.push(it);
      continue;
    }
    const g = map.get(it.source.supplierId) ?? {
      supplierId: it.source.supplierId,
      supplierName: it.source.supplierName,
      items: [],
      packs: 0,
      creditPaise: 0,
      invoices: 0,
    };
    g.items.push(it);
    g.packs += it.packs;
    g.creditPaise += it.creditPaise;
    map.set(g.supplierId, g);
  }
  for (const g of map.values())
    g.invoices = new Set(g.items.map((i) => i.source!.purchaseId)).size;
  return {
    groups: [...map.values()].sort((a, b) => b.creditPaise - a.creditPaise),
    noInvoice,
  };
}

/** The reason the debit notes carry: all expired → "expired" */
export function expiryReason(items: readonly ExpiryItem[]): ReturnReason {
  return items.every((i) => i.state === "expired") ? "expired" : "near_expiry";
}

/** Bulk return input: lines grouped per invoice */
export type ExpiryReturnInput = {
  supplierId: string;
  date: string;
  reason: ReturnReason;
  notes: string;
  items: { purchaseId: string; purchaseLineId: string; qty: number }[];
};

export function byInvoice(items: ExpiryReturnInput["items"]) {
  const m = new Map<string, { purchaseLineId: string; qty: number }[]>();
  for (const i of items) {
    if (i.qty <= 0) continue;
    const list = m.get(i.purchaseId) ?? [];
    const same = list.find((l) => l.purchaseLineId === i.purchaseLineId);
    if (same) same.qty += i.qty;
    else list.push({ purchaseLineId: i.purchaseLineId, qty: i.qty });
    m.set(i.purchaseId, list);
  }
  return m;
}
