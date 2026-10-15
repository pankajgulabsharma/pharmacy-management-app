import { describe, expect, it } from "vitest";
import type { StockBatch } from "../inventory/types";
import type { Medicine } from "../medicines/types";
import type { Purchase } from "../purchases/types";
import type { Sale } from "../billing/types";
import { deadStock, orderList, orderText, profitBy } from "./stockInsights";

const NOW = new Date("2026-10-15T12:00:00Z");
const daysAgo = (n: number) =>
  new Date(NOW.getTime() - n * 86_400_000).toISOString();

const med = (id: string, over: Partial<Medicine> = {}): Medicine =>
  ({
    id,
    name: `Med ${id}`,
    brand: "Cipla",
    unit: "STP",
    unitsPerStrip: 10,
    minStock: 0,
    status: "active",
    category: "tablet_capsule",
    ...over,
  }) as Medicine;

const batch = (
  medicineId: string,
  qtyStrip: number,
  over: Partial<StockBatch> = {},
): StockBatch => ({
  id: `b-${medicineId}-${qtyStrip}-${over.expiry ?? "12/28"}`,
  medicineId,
  batchNo: "B1",
  expiry: "12/28",
  qtyStrip,
  qtyLoose: 0,
  mrp: 30,
  purchasePrice: 20,
  receivedAt: daysAgo(200),
  ...over,
});

describe("dead stock", () => {
  const medicines = [med("a"), med("b"), med("c"), med("d"), med("e")];
  const batches = [
    batch("a", 10), // sold yesterday → alive
    batch("b", 50), // last sold 120 days ago → dead
    batch("c", 5), // never sold, on the shelf for 200 days → dead
    batch("d", 5, { receivedAt: daysAgo(10) }), // new, not sold yet → not dead
    batch("e", 30, { expiry: "01/26" }), // expired → not "dead stock" (expired list)
  ];
  const velocity = [
    { medicineId: "a", lastSoldAt: daysAgo(1), soldPacks: 20 },
    { medicineId: "b", lastSoldAt: daysAgo(120), soldPacks: 0 },
  ];

  it("lists what hasn't sold in N days, most money locked first", () => {
    const r = deadStock(medicines, batches, velocity, 90, NOW);
    expect(r.rows.map((x) => x.medicineId)).toEqual(["b", "c"]);
    expect(r.rows[0]).toMatchObject({
      packs: 50,
      idleDays: 120,
      costPaise: 1000_00,
    });
    expect(r.rows[1]).toMatchObject({ lastSoldAt: null, idleDays: null });
    expect(r.costPaise).toBe(1000_00 + 100_00);
  });

  it("a longer window is stricter", () => {
    expect(
      deadStock(medicines, batches, velocity, 180, NOW).rows.map(
        (x) => x.medicineId,
      ),
    ).toEqual(["c"]);
  });
});

describe("what to order", () => {
  const purchases = [
    {
      status: "active",
      supplierName: "Old Agency",
      invoiceDate: "2026-05-01",
      lines: [{ medicineId: "fast" }],
    },
    {
      status: "active",
      supplierName: "New Agency",
      invoiceDate: "2026-09-01",
      lines: [{ medicineId: "fast" }],
    },
  ] as unknown as Purchase[];

  it("covers the next days at the current speed, minus usable stock", () => {
    const r = orderList(
      [med("fast"), med("slow"), med("min", { minStock: 10 })],
      [
        batch("fast", 10),
        // expires within the 30 days → not counted as usable
        batch("fast", 40, { expiry: "10/26" }),
        batch("slow", 50),
        batch("min", 4),
      ],
      [
        { medicineId: "fast", lastSoldAt: daysAgo(1), soldPacks: 60 }, // 2/day
        { medicineId: "slow", lastSoldAt: daysAgo(3), soldPacks: 15 },
      ],
      purchases,
      { days: 30, coverDays: 30 },
      NOW,
    );
    // fast: needs 60 for 30 days, has 10 usable → 50
    expect(r.rows[0]).toMatchObject({
      medicineId: "fast",
      orderPacks: 50,
      perDay: 2,
      inStockPacks: 10,
      daysLeft: 5,
      lastSupplier: "New Agency",
      estCostPaise: 50 * 20_00,
      reason: "selling",
    });
    // slow has 50, needs 15 → nothing to order
    expect(r.rows.some((x) => x.medicineId === "slow")).toBe(false);
    // not selling, but below its minimum of 10
    expect(r.rows.find((x) => x.medicineId === "min")).toMatchObject({
      orderPacks: 6,
      reason: "below_min",
      daysLeft: null,
    });
  });

  it("as text for WhatsApp", () => {
    const t = orderText(
      [{ name: "Dolo 650 Tablet", orderPacks: 20, unit: "STP" }] as never,
      "Shree Sai Medical",
      NOW,
    );
    expect(t).toMatch(
      /^Order — Shree Sai Medical — 15 Oct 2026\n1\. Dolo 650 Tablet — 20 STP$/,
    );
  });
});

describe("profit by medicine and company", () => {
  it("sales − cost of the batches actually sold", () => {
    const sale = {
      createdAt: daysAgo(1),
      lines: [
        {
          medicineId: "a",
          medicineName: "Med a",
          brand: "Cipla",
          unit: "STP",
          unitsPerStrip: 10,
          qtyStrip: 2,
          qtyLoose: 5,
          amountPaise: 75_00,
          allocations: [{ batchId: "b1", qtyStrip: 2, qtyLoose: 5 }],
        },
      ],
    } as unknown as Sale;
    const r = profitBy(
      [sale],
      [{ id: "b1", purchasePrice: 20 } as StockBatch],
      [med("a")],
      { from: new Date(daysAgo(7)), to: NOW },
    );
    // 2.5 strips × ₹20 = ₹50 cost; ₹75 sales → ₹25 profit, 33.3 %
    expect(r.medicines[0]).toMatchObject({
      soldPacks: 2.5,
      costPaise: 50_00,
      profitPaise: 25_00,
      marginPct: 33.3,
      detail: "Cipla",
    });
    expect(r.companies[0]).toMatchObject({
      name: "Cipla",
      detail: "1 medicine",
      profitPaise: 25_00,
    });
  });
});
