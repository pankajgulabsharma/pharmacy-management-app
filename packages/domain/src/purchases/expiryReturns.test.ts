import { describe, expect, it } from "vitest";
import type { Medicine } from "../medicines/types";
import type { StockBatch } from "../inventory/types";
import { debitNoteHtml } from "./debitNote";
import {
  byInvoice,
  expiryItems,
  expiryReason,
  groupBySupplier,
} from "./expiryReturns";
import type { Purchase, PurchaseLine, PurchaseReturn } from "./types";

const now = new Date(2026, 9, 22); // 22 Oct 2026
const med = (id: string, unit = "STP") =>
  ({
    id,
    name: `Med ${id}`,
    brand: "Co",
    unit,
    unitsPerStrip: 10,
    status: "active",
  }) as Medicine;
const batch = (
  id: string,
  medicineId: string,
  expiry: string,
  qtyStrip: number,
  qtyLoose = 0,
) =>
  ({
    id,
    medicineId,
    batchNo: `B${id}`,
    expiry,
    qtyStrip,
    qtyLoose,
    mrp: 100,
    purchasePrice: 50,
    receivedAt: "",
  }) as StockBatch;
const line = (
  id: string,
  medicineId: string,
  batchNo: string,
  expiry: string,
  qty: number,
): PurchaseLine =>
  ({
    id,
    medicineId,
    medicineName: `Med ${medicineId}`,
    brand: "Co",
    hsn: "",
    unit: "STP",
    unitsPerStrip: 10,
    batchNo,
    expiry,
    qty,
    freeQty: 0,
    ratePaise: 5000,
    mrpPaise: 10000,
    discountPercent: 0,
    gstPercent: 5,
  }) as PurchaseLine;
const purchase = (
  id: string,
  supplierId: string,
  date: string,
  lines: PurchaseLine[],
) =>
  ({
    id,
    status: "active",
    stockPosted: true,
    supplierId,
    supplierName: `Sup ${supplierId}`,
    supplierGstin: "",
    invoiceNo: `INV-${id}`,
    invoiceDate: date,
    dueDate: date,
    createdAt: `${date}T10:00:00`,
    lines,
    notes: "",
    paidPaise: 0,
    returnedPaise: 0,
    totals: {} as Purchase["totals"],
    revision: 1,
    updatedAt: "",
  }) as Purchase;

describe("expiry return", () => {
  const meds = [med("m1"), med("m2"), med("m3")];
  const batches = [
    batch("b1", "m1", "09/26", 8, 4), // expired, 8 strips + 4 loose
    batch("b2", "m2", "12/26", 5), // short-dated
    batch("b3", "m3", "10/28", 9), // fine
  ];
  const purchases = [
    // b1 came on two invoices: 5 + 6 strips
    purchase("p1", "s1", "2026-01-10", [line("l1", "m1", "Bb1", "09/26", 5)]),
    purchase("p2", "s1", "2026-03-10", [
      line("l2", "m1", "Bb1", "09/26", 6),
      line("l3", "m2", "Bb2", "12/26", 3),
    ]),
    purchase("p3", "s2", "2026-04-01", [line("l4", "m3", "Bb3", "10/28", 9)]),
  ];

  it("traces stock to invoices, newest first; the rest is 'no invoice'", () => {
    const items = expiryItems(
      batches,
      meds,
      purchases,
      [],
      { nearDays: 90 },
      now,
    );
    const b1 = items.filter((i) => i.batchId === "b1");
    expect(b1.map((i) => [i.source?.invoiceNo, i.packs])).toEqual([
      ["INV-p2", 6],
      ["INV-p1", 2],
    ]);
    expect(b1[0].loose).toBe(4);
    expect(b1[0].state).toBe("expired");
    const b2 = items.filter((i) => i.batchId === "b2");
    expect(b2.map((i) => [i.source?.invoiceNo ?? null, i.packs])).toEqual([
      ["INV-p2", 3],
      [null, 2],
    ]);
    expect(items.some((i) => i.batchId === "b3")).toBe(false);

    const { groups, noInvoice } = groupBySupplier(items);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      supplierId: "s1",
      invoices: 2,
      packs: 11,
    });
    expect(noInvoice).toHaveLength(1);
  });

  it("already returned packs are not offered again", () => {
    const ret = {
      purchaseId: "p2",
      lines: [{ purchaseLineId: "l2", qty: 6 }],
    } as unknown as PurchaseReturn;
    const items = expiryItems(
      batches,
      meds,
      purchases,
      [ret],
      { nearDays: 0 },
      now,
    );
    expect(items.map((i) => [i.source?.invoiceNo ?? null, i.packs])).toEqual([
      ["INV-p1", 5],
      [null, 3],
    ]);
  });

  it("groups lines per invoice and picks the reason", () => {
    const m = byInvoice([
      { purchaseId: "p1", purchaseLineId: "l1", qty: 2 },
      { purchaseId: "p1", purchaseLineId: "l1", qty: 1 },
      { purchaseId: "p2", purchaseLineId: "l2", qty: 0 },
    ]);
    expect([...m]).toEqual([["p1", [{ purchaseLineId: "l1", qty: 3 }]]]);
    expect(expiryReason([{ state: "expired" }] as never)).toBe("expired");
    expect(
      expiryReason([{ state: "expired" }, { state: "near" }] as never),
    ).toBe("near_expiry");
  });

  it("prints a debit note with the credit asked for", () => {
    const r = {
      returnNo: "DN/26-27/0003",
      invoiceNo: "INV-p2",
      date: "2026-10-22",
      reason: "expired",
      notes: "",
      totalQty: 6,
      totalPaise: 31500,
      gstPaise: 1500,
      lines: [
        {
          medicineName: "Med <m1>",
          unit: "STP",
          unitsPerStrip: 10,
          batchNo: "Bb1",
          expiry: "09/26",
          qty: 6,
          ratePaise: 5250,
          gstPercent: 5,
          amountPaise: 31500,
        },
      ],
    } as unknown as PurchaseReturn;
    const html = debitNoteHtml({
      shop: { name: "Shop" },
      supplier: { name: "Sup" },
      returns: [r],
    });
    expect(html).toContain("DN/26-27/0003");
    expect(html).not.toContain("<m1>");
    expect(html).toContain("₹315.00");
  });
});
