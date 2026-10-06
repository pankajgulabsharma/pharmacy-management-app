/**
 * Puts the demo shop (3 months of history) into the database — built by
 * @medicare/demo with the real rules, so every number is consistent.
 * One transaction: all of it goes in, or nothing does.
 */
import { DEFAULT_SETTINGS } from "@medicare/domain/settings/defaults";
import { rupeesToPaise } from "@medicare/domain/lib/money";
import { mockMedicines } from "@medicare/demo/data/mockMedicines";
import { mockSuppliers } from "@medicare/demo/data/mockSuppliers";
import {
  demoCustomerPayments,
  demoCustomers,
  demoHeldBills,
  demoInventory,
  demoPurchases,
  demoReturns,
  demoSaleReturns,
  demoSales,
} from "@medicare/demo/seed";
import type { Database } from "./client";
import * as t from "./schema";

/** Insert many rows without hitting SQLite's parameter limit */
async function insertAll<T extends { _: { name: string } }>(
  tx: Parameters<Parameters<Database["db"]["transaction"]>[0]>[0],
  table: T,
  rows: Record<string, unknown>[],
) {
  for (let i = 0; i < rows.length; i += 100) {
    // eslint-free cast: Drizzle's insert typing per table is not needed here
    await tx.insert(table as never).values(rows.slice(i, i + 100) as never);
  }
}

export async function seedDemoData({
  db,
}: Database): Promise<Record<string, number>> {
  const now = new Date().toISOString();
  const rows = {
    medicines: mockMedicines.map((m) => ({
      ...m,
      mrpPaise: rupeesToPaise(m.mrp),
      salePricePaise: rupeesToPaise(m.salePrice),
    })),
    suppliers: mockSuppliers.map((s) => ({ ...s })),
    batches: demoInventory.batches.map((b) => ({
      ...b,
      mrpPaise: rupeesToPaise(b.mrp),
      purchasePricePaise: rupeesToPaise(b.purchasePrice),
    })),
    stockMovements: demoInventory.movements.map((m) => ({ ...m })),
    purchases: demoPurchases.map((p) => ({ ...p, ...p.totals })),
    purchaseLines: demoPurchases.flatMap((p) =>
      p.lines.map((l, position) => ({ ...l, purchaseId: p.id, position })),
    ),
    purchaseReturns: demoReturns.map((r) => ({ ...r })),
    purchaseReturnLines: demoReturns.flatMap((r) =>
      r.lines.map((l) => ({ ...l, returnId: r.id })),
    ),
    customers: demoCustomers.map((c) => ({ ...c })),
    customerPayments: demoCustomerPayments.map((p) => ({ ...p })),
    sales: demoSales.map((s) => ({
      ...s,
      ...s.totals,
      paymentMethod: s.payment.method,
      receivedPaise: s.payment.receivedPaise,
      changePaise: s.payment.changePaise,
      splitCashPaise: s.payment.split?.cashPaise ?? 0,
      splitUpiPaise: s.payment.split?.upiPaise ?? 0,
      splitCardPaise: s.payment.split?.cardPaise ?? 0,
      paymentReference: s.payment.reference,
      customerId: s.customerId ?? null,
      imported: s.imported ?? false,
    })),
    saleLines: demoSales.flatMap((s) =>
      s.lines.map((l, position) => ({ ...l, saleId: s.id, position })),
    ),
    saleAllocations: demoSales.flatMap((s) =>
      s.lines.flatMap((l) =>
        l.allocations.map((a) => ({ ...a, saleLineId: l.id })),
      ),
    ),
    saleReturns: demoSaleReturns.map((r) => ({ ...r })),
    saleReturnLines: demoSaleReturns.flatMap((r) =>
      r.lines.map((l) => ({ ...l, returnId: r.id })),
    ),
    saleReturnBatches: demoSaleReturns.flatMap((r) =>
      r.lines.flatMap((l) =>
        l.batches.map((b) => ({ ...b, returnLineId: l.id })),
      ),
    ),
    heldBills: demoHeldBills.map((h) => ({
      ...h,
      linesJson: JSON.stringify(h.lines),
    })),
    settings: Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({
      key,
      valueJson: JSON.stringify(value),
      updatedAt: now,
    })),
  } satisfies Partial<Record<keyof typeof t, Record<string, unknown>[]>>;

  // Parents before children (foreign keys)
  await db.transaction(async (tx) => {
    for (const [name, list] of Object.entries(rows)) {
      await insertAll(tx, t[name as keyof typeof rows], list);
    }
  });
  return Object.fromEntries(
    Object.entries(rows).map(([k, v]) => [k, v.length]),
  );
}

/** True when the shop already has data (never overwrite real data by accident) */
export async function hasData({ raw }: Database): Promise<boolean> {
  const r = raw
    .prepare("SELECT EXISTS (SELECT 1 FROM medicines) AS has")
    .get() as { has: number };
  return r.has === 1;
}
