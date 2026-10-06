import { describe, expect, it } from "vitest";
import type { InventoryBatch } from "../types";
import {
  batchCostPaise,
  batchMrpPaise,
  batchStatus,
  batchStatuses,
  sellableTotals,
} from "./stock";
import { stockLevel } from "@/features/medicines/utils/stockLevel";

const NOW = new Date(2026, 9, 5); // 5 Oct 2026

function b(over: Partial<InventoryBatch>): InventoryBatch {
  return {
    id: "b",
    medicineId: "m",
    batchNo: "B1",
    expiry: "12/28",
    qtyStrip: 50,
    qtyLoose: 0,
    unit: "STP",
    minStock: 10,
    ...over,
  } as InventoryBatch;
}

describe("batchStatus — exactly one status per batch", () => {
  it("follows the priority out → expired → expiring → low → ok", () => {
    const totals = new Map([["m", 3]]); // medicine is low overall
    expect(batchStatus(b({ qtyStrip: 0 }), totals, NOW, 90)).toBe("out");
    expect(batchStatus(b({ expiry: "08/26" }), totals, NOW, 90)).toBe(
      "expired",
    );
    expect(batchStatus(b({ expiry: "11/26" }), totals, NOW, 90)).toBe(
      "expiring",
    );
    expect(batchStatus(b({}), totals, NOW, 90)).toBe("low");
    expect(batchStatus(b({}), new Map([["m", 50]]), NOW, 90)).toBe("ok");
  });

  it("low is about the MEDICINE's total, not one small batch", () => {
    const batches = [
      b({ id: "a", qtyStrip: 5 }),
      b({ id: "c", qtyStrip: 280 }),
    ];
    const st = batchStatuses(batches, NOW, 90);
    expect([st.get("a"), st.get("c")]).toEqual(["ok", "ok"]);
  });

  it("expired stock never counts towards the medicine's total", () => {
    const batches = [
      b({ id: "old", expiry: "01/26", qtyStrip: 500 }),
      b({ id: "new", qtyStrip: 4 }),
    ];
    expect(sellableTotals(batches, NOW).get("m")).toBe(4);
    expect(batchStatuses(batches, NOW, 90).get("new")).toBe("low");
  });

  it("chips never overlap: every batch is counted once", () => {
    const batches = [
      b({ id: "1", qtyStrip: 0 }),
      b({ id: "2", expiry: "08/26" }),
      b({ id: "3", expiry: "11/26" }),
      b({ id: "4", medicineId: "x", qtyStrip: 2 }),
      b({ id: "5", qtyStrip: 90 }),
    ];
    const counts = new Map<string, number>();
    for (const s of batchStatuses(batches, NOW, 90).values())
      counts.set(s, (counts.get(s) ?? 0) + 1);
    expect([...counts.values()].reduce((a, c) => a + c, 0)).toBe(
      batches.length,
    );
  });
});

describe("stockLevel — one rule for Medicines, Dashboard and Reports", () => {
  const m = { unit: "STP" as const, minStock: 10 };
  it("out when nothing sellable is left (expired stock excluded upstream)", () => {
    expect(stockLevel({ ...m, sellableStrip: 0, sellableLoose: 0 })).toBe(
      "out",
    );
  });
  it("low below the minimum, ok at or above it", () => {
    expect(stockLevel({ ...m, sellableStrip: 9, sellableLoose: 0 })).toBe(
      "low",
    );
    expect(stockLevel({ ...m, sellableStrip: 10, sellableLoose: 0 })).toBe(
      "ok",
    );
  });
  it("loose-only (LSE) medicines are judged by loose units", () => {
    expect(
      stockLevel({
        unit: "LSE",
        minStock: 20,
        sellableStrip: 0,
        sellableLoose: 50,
      }),
    ).toBe("ok");
  });
});

describe("batch valuation — one formula everywhere", () => {
  it("counts loose units as a fraction of a pack, in paise", () => {
    const m = { unit: "STP", unitsPerStrip: 10 };
    const v = { qtyStrip: 2, qtyLoose: 5, purchasePrice: 18.5, mrp: 30 };
    expect(batchCostPaise(v, m)).toBe(4625); // 2.5 × ₹18.50
    expect(batchMrpPaise(v, m)).toBe(7500);
  });
  it("loose-only (LSE) items are valued per unit", () => {
    expect(
      batchCostPaise(
        { qtyStrip: 0, qtyLoose: 12, purchasePrice: 1.25, mrp: 2 },
        { unit: "LSE", unitsPerStrip: 1 },
      ),
    ).toBe(1500);
  });
});
