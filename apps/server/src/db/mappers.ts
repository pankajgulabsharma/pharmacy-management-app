/**
 * Database rows ↔ the app's own objects (@medicare/domain types), for every
 * stock-and-money document. Used by the seed, the loaders and the writers —
 * one place, so what is saved is exactly what is read back.
 */
import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import { rupeesToPaise } from "@medicare/domain/lib/money";
import type {
  HeldBill,
  Sale,
  SaleLine,
  SaleReturn,
} from "@medicare/domain/billing/types";
import type {
  Customer,
  CustomerPayment,
} from "@medicare/domain/customers/types";
import type {
  StockBatch,
  StockMovement,
} from "@medicare/domain/inventory/types";
import type {
  Purchase,
  PurchaseReturn,
} from "@medicare/domain/purchases/types";
import type { Medicine } from "@medicare/domain/medicines/types";
import type { Supplier } from "@medicare/domain/suppliers/types";
import * as t from "./schema";
import { insertRows, selectRows, updateRow } from "./sync";

type Row = Record<string, unknown>;
const rupees = (paise: number) => paise / 100;
const groupBy = <T extends Row>(rows: T[], key: string) => {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = r[key] as string;
    (m.get(k) ?? m.set(k, []).get(k)!).push(r);
  }
  return m;
};
/** `id IN (?, ?, …)` for a list (SQLite allows plenty of parameters) */
const inList = (ids: readonly string[]) =>
  `(${ids.map(() => "?").join(",") || "NULL"})`;

/* ---------------- Stock ---------------- */

export const batchToRow = (b: StockBatch) => ({
  ...b,
  mrpPaise: rupeesToPaise(b.mrp),
  purchasePricePaise: rupeesToPaise(b.purchasePrice),
});
const rowToBatch = ({ mrpPaise, purchasePricePaise, ...r }: Row): StockBatch =>
  ({
    ...r,
    mrp: rupees(mrpPaise as number),
    purchasePrice: rupees(purchasePricePaise as number),
  }) as StockBatch;

export const movementToRow = (m: StockMovement) => ({
  ...m,
  refId: m.refId ?? "",
});
const rowToMovement = ({ refId, ...r }: Row): StockMovement =>
  ({ ...r, ...(refId ? { refId } : {}) }) as StockMovement;

export function loadBatches(
  raw: DatabaseSync,
  where = "",
  params: SQLInputValue[] = [],
): StockBatch[] {
  return selectRows(raw, t.batches, where, params, "medicine_id, expiry").map(
    rowToBatch,
  );
}
export function loadMovements(
  raw: DatabaseSync,
  where = "",
  params: SQLInputValue[] = [],
): StockMovement[] {
  return selectRows(
    raw,
    t.stockMovements,
    where,
    params,
    "at DESC, rowid DESC",
  ).map(rowToMovement);
}

/**
 * Save a stock operation: new batches inserted, changed batches updated,
 * movements appended. `before` = the batches the operation started from.
 *
 * In the database a batch is NEVER deleted — its movement history hangs on
 * it. When a rule drops a batch from the list (a purchase cancelled or
 * edited away), it stays with 0 stock; when the same batch comes back
 * (edit re-posts it), the existing row is reused, not duplicated.
 */
export function saveStock(
  raw: DatabaseSync,
  before: readonly StockBatch[],
  after: readonly StockBatch[],
  movements: readonly StockMovement[],
) {
  const old = new Map(before.map((b) => [b.id, b]));
  const kept = new Set(after.map((b) => b.id));
  const sameBatch = (a: StockBatch, b: StockBatch) =>
    a.medicineId === b.medicineId && a.batchNo === b.batchNo;
  const dropped = before.filter((b) => !kept.has(b.id));
  const idMap = new Map<string, string>(); // new id → reused old id

  const changed: StockBatch[] = [];
  for (const nb of after) {
    let b = nb;
    if (!old.has(b.id)) {
      const reuse = dropped.find((d) => sameBatch(d, b));
      if (reuse) {
        dropped.splice(dropped.indexOf(reuse), 1);
        idMap.set(b.id, reuse.id);
        b = { ...b, id: reuse.id, receivedAt: reuse.receivedAt };
      }
    }
    const prev = old.get(b.id);
    if (!prev) insertRows(raw, t.batches, [batchToRow(b)]);
    else if (JSON.stringify(prev) !== JSON.stringify(b))
      updateRow(raw, t.batches, "id", batchToRow(b));
    else continue;
    changed.push(b);
  }
  for (const d of dropped) {
    const empty = { ...d, qtyStrip: 0, qtyLoose: 0 };
    if (d.qtyStrip !== 0 || d.qtyLoose !== 0)
      updateRow(raw, t.batches, "id", batchToRow(empty));
    changed.push(empty);
  }
  const saved = movements.map((m) =>
    idMap.has(m.batchId) ? { ...m, batchId: idMap.get(m.batchId)! } : m,
  );
  insertRows(raw, t.stockMovements, saved.map(movementToRow));
  return { batches: changed, movements: saved };
}

/* ---------------- Purchases ---------------- */

export function purchaseRows(p: Purchase) {
  return {
    purchase: {
      ...p,
      ...p.totals,
      cancelledAt: p.cancelledAt ?? "",
      cancelReason: p.cancelReason ?? "",
    },
    lines: p.lines.map((l, position) => ({ ...l, purchaseId: p.id, position })),
  };
}
export function insertPurchase(raw: DatabaseSync, p: Purchase) {
  const r = purchaseRows(p);
  insertRows(raw, t.purchases, [r.purchase]);
  insertRows(raw, t.purchaseLines, r.lines);
}
/** Header + lines replaced (an edit can change lines) */
export function replacePurchase(raw: DatabaseSync, p: Purchase) {
  const r = purchaseRows(p);
  updateRow(raw, t.purchases, "id", r.purchase);
  raw.prepare("DELETE FROM purchase_lines WHERE purchase_id = ?").run(p.id);
  insertRows(raw, t.purchaseLines, r.lines);
}

const TOTAL_KEYS = [
  "lineCount",
  "totalQty",
  "totalFreeQty",
  "grossPaise",
  "discountPaise",
  "taxablePaise",
  "cgstPaise",
  "sgstPaise",
  "gstPaise",
  "roundOffPaise",
  "netPaise",
] as const;

export function loadPurchases(
  raw: DatabaseSync,
  where = "",
  params: SQLInputValue[] = [],
): Purchase[] {
  const heads = selectRows(raw, t.purchases, where, params, "created_at DESC");
  const lines = groupBy(
    selectRows(
      raw,
      t.purchaseLines,
      `purchase_id IN ${inList(heads.map((h) => h.id as string))}`,
      heads.map((h) => h.id as string),
      "position",
    ),
    "purchaseId",
  );
  return heads.map((h) => {
    const totals = Object.fromEntries(TOTAL_KEYS.map((k) => [k, h[k]]));
    const rest = Object.fromEntries(
      Object.entries(h).filter(
        ([k]) => !(TOTAL_KEYS as readonly string[]).includes(k),
      ),
    );
    const { cancelledAt, cancelReason, ...head } = rest;
    return {
      ...head,
      ...(cancelledAt ? { cancelledAt, cancelReason } : {}),
      totals,
      lines: (lines.get(h.id as string) ?? []).map(
        ({ purchaseId: _p, position: _i, ...l }) => l,
      ),
    } as unknown as Purchase;
  });
}

export function insertPurchaseReturn(raw: DatabaseSync, r: PurchaseReturn) {
  insertRows(raw, t.purchaseReturns, [r]);
  insertRows(
    raw,
    t.purchaseReturnLines,
    r.lines.map((l) => ({ ...l, returnId: r.id })),
  );
}
export function loadPurchaseReturns(
  raw: DatabaseSync,
  where = "",
  params: SQLInputValue[] = [],
): PurchaseReturn[] {
  const heads = selectRows(
    raw,
    t.purchaseReturns,
    where,
    params,
    "created_at DESC",
  );
  const lines = groupBy(
    selectRows(
      raw,
      t.purchaseReturnLines,
      `return_id IN ${inList(heads.map((h) => h.id as string))}`,
      heads.map((h) => h.id as string),
    ),
    "returnId",
  );
  return heads.map(
    (h) =>
      ({
        ...h,
        lines: (lines.get(h.id as string) ?? []).map(
          ({ returnId: _r, ...l }) => l,
        ),
      }) as unknown as PurchaseReturn,
  );
}

/* ---------------- Sales ---------------- */

const SALE_TOTAL_KEYS = [
  "itemCount",
  "grossPaise",
  "discountPaise",
  "taxablePaise",
  "cgstPaise",
  "sgstPaise",
  "gstPaise",
  "roundOffPaise",
  "netPaise",
] as const;

export function saleRows(s: Sale) {
  const p = s.payment;
  return {
    sale: {
      ...s,
      ...s.totals,
      paymentMethod: p.method,
      receivedPaise: p.receivedPaise,
      changePaise: p.changePaise,
      splitCashPaise: p.split?.cashPaise ?? 0,
      splitUpiPaise: p.split?.upiPaise ?? 0,
      splitCardPaise: p.split?.cardPaise ?? 0,
      paymentReference: p.reference,
      customerId: s.customerId ?? null,
      imported: s.imported ?? false,
      billedBy: s.billedBy ?? "",
    },
    lines: s.lines.map((l, position) => ({ ...l, saleId: s.id, position })),
    allocations: s.lines.flatMap((l) =>
      l.allocations.map((a) => ({ ...a, saleLineId: l.id })),
    ),
  };
}
export function insertSale(raw: DatabaseSync, s: Sale) {
  const r = saleRows(s);
  insertRows(raw, t.sales, [r.sale]);
  insertRows(raw, t.saleLines, r.lines);
  insertRows(raw, t.saleAllocations, r.allocations);
}

export function loadSales(
  raw: DatabaseSync,
  where = "",
  params: SQLInputValue[] = [],
): Sale[] {
  const heads = selectRows(
    raw,
    t.sales,
    where,
    params,
    "created_at DESC, rowid DESC",
  );
  const ids = heads.map((h) => h.id as string);
  // Lines/allocations: by join, so this stays fast however many bills there are
  const lineRows = selectRows(
    raw,
    t.saleLines,
    ids.length === heads.length && !where ? "" : `sale_id IN ${inList(ids)}`,
    ids.length === heads.length && !where ? [] : ids,
    "position",
  );
  const lineIds = new Set(lineRows.map((l) => l.id as string));
  const allocs = groupBy(
    selectRows(
      raw,
      t.saleAllocations,
      where
        ? `sale_line_id IN (SELECT id FROM sale_lines WHERE sale_id IN ${inList(ids)})`
        : "",
      where ? ids : [],
      "id",
    ).filter((a) => lineIds.has(a.saleLineId as string)),
    "saleLineId",
  );
  const lines = groupBy(lineRows, "saleId");
  return heads.map((h) => {
    const totals = Object.fromEntries(SALE_TOTAL_KEYS.map((k) => [k, h[k]]));
    const split =
      (h.splitCashPaise as number) +
        (h.splitUpiPaise as number) +
        (h.splitCardPaise as number) >
      0
        ? {
            cashPaise: h.splitCashPaise,
            upiPaise: h.splitUpiPaise,
            cardPaise: h.splitCardPaise,
          }
        : null;
    const sale: Row = {
      id: h.id,
      billNo: h.billNo,
      createdAt: h.createdAt,
      customerName: h.customerName,
      doctor: h.doctor,
      counter: h.counter,
      status: h.status,
      returnedPaise: h.returnedPaise,
      customerId: h.customerId,
      totals,
      payment: {
        method: h.paymentMethod,
        receivedPaise: h.receivedPaise,
        changePaise: h.changePaise,
        split,
        reference: h.paymentReference,
      },
      lines: (lines.get(h.id as string) ?? []).map(
        ({ saleId: _s, position: _p, ...l }) => ({
          ...l,
          allocations: (allocs.get(l.id as string) ?? []).map(
            ({ id: _i, saleLineId: _l, ...a }) => a,
          ),
        }),
      ) as SaleLine[],
    };
    if (h.imported) sale.imported = true;
    if (h.billedBy) sale.billedBy = h.billedBy;
    return sale as unknown as Sale;
  });
}

export function insertSaleReturn(raw: DatabaseSync, r: SaleReturn) {
  insertRows(raw, t.saleReturns, [{ ...r, billedBy: r.billedBy ?? "" }]);
  insertRows(
    raw,
    t.saleReturnLines,
    r.lines.map((l) => ({ ...l, returnId: r.id })),
  );
  insertRows(
    raw,
    t.saleReturnBatches,
    r.lines.flatMap((l) =>
      l.batches.map((b) => ({ ...b, returnLineId: l.id })),
    ),
  );
}
export function loadSaleReturns(
  raw: DatabaseSync,
  where = "",
  params: SQLInputValue[] = [],
): SaleReturn[] {
  const heads = selectRows(
    raw,
    t.saleReturns,
    where,
    params,
    "created_at DESC",
  );
  const ids = heads.map((h) => h.id as string);
  const lineRows = selectRows(
    raw,
    t.saleReturnLines,
    `return_id IN ${inList(ids)}`,
    ids,
  );
  const batches = groupBy(
    selectRows(
      raw,
      t.saleReturnBatches,
      `return_line_id IN ${inList(lineRows.map((l) => l.id as string))}`,
      lineRows.map((l) => l.id as string),
      "id",
    ),
    "returnLineId",
  );
  const lines = groupBy(lineRows, "returnId");
  return heads.map(
    (h) =>
      ({
        ...h,
        billedBy: (h.billedBy as string) || undefined,
        lines: (lines.get(h.id as string) ?? []).map(
          ({ returnId: _r, ...l }) => ({
            ...l,
            batches: (batches.get(l.id as string) ?? []).map(
              ({ id: _i, returnLineId: _l, ...b }) => b,
            ),
          }),
        ),
      }) as unknown as SaleReturn,
  );
}

/* ---------------- Held bills, customers ---------------- */

export const heldToRow = (h: HeldBill) => ({
  ...h,
  linesJson: JSON.stringify(h.lines),
});
export function loadHeld(raw: DatabaseSync): HeldBill[] {
  return selectRows(raw, t.heldBills, "", [], "held_at DESC").map(
    ({ linesJson, ...h }) =>
      ({ ...h, lines: JSON.parse(linesJson as string) }) as HeldBill,
  );
}

export function loadCustomers(
  raw: DatabaseSync,
  where = "",
  params: SQLInputValue[] = [],
): Customer[] {
  return selectRows<Customer>(raw, t.customers, where, params, "name");
}
export function loadCustomerPayments(
  raw: DatabaseSync,
  where = "",
  params: SQLInputValue[] = [],
): CustomerPayment[] {
  return selectRows<CustomerPayment>(
    raw,
    t.customerPayments,
    where,
    params,
    "at DESC",
  );
}

/* ---------------- Masters (sync reads for operations) ---------------- */

export function loadMedicinesSync(raw: DatabaseSync): Medicine[] {
  return selectRows(raw, t.medicines).map(
    ({ mrpPaise, salePricePaise, ...r }) =>
      ({
        ...r,
        mrp: rupees(mrpPaise as number),
        salePrice: rupees(salePricePaise as number),
      }) as Medicine,
  );
}
export function loadSuppliersSync(raw: DatabaseSync): Supplier[] {
  return selectRows<Supplier>(raw, t.suppliers);
}
