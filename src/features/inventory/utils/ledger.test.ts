import { describe, expect, it } from "vitest";
import type { StockBatch, StockReceipt } from "../types";
import {
  StockError,
  applyAdjustment,
  applyIssue,
  applyReceipt,
  applyReversal,
  checkReversal,
  summarizeStock,
} from "./ledger";

const KNOWN = new Set(["m1", "m30"]);

function batch(over: Partial<StockBatch> = {}): StockBatch {
  return {
    id: "b1",
    medicineId: "m1",
    batchNo: "DL001",
    expiry: "08/27",
    qtyStrip: 10,
    qtyLoose: 0,
    mrp: 48,
    purchasePrice: 30,
    receivedAt: "2026-09-01T00:00:00.000Z",
    ...over,
  };
}

function receipt(
  lines: Partial<StockReceipt["lines"][number]>[],
): StockReceipt {
  return {
    refId: "pur_1",
    note: "Purchase INV-1",
    at: new Date("2026-10-01T10:00:00Z"),
    lines: lines.map((l) => ({
      medicineId: "m1",
      unit: "STP",
      batchNo: "DL001",
      expiry: "08/27",
      packs: 10,
      mrp: 48,
      costPerPack: 36,
      ...l,
    })),
  };
}

describe("applyReceipt", () => {
  it("adds to an existing batch and averages the cost", () => {
    const { batches, movements } = applyReceipt(
      [batch()],
      receipt([{}]),
      KNOWN,
    );
    expect(batches).toHaveLength(1);
    expect(batches[0].qtyStrip).toBe(20);
    expect(batches[0].purchasePrice).toBe(33); // (10×30 + 10×36) / 20
    expect(movements[0]).toMatchObject({
      type: "purchase",
      batchId: "b1",
      qtyStripDelta: 10,
      refId: "pur_1",
    });
  });

  it("matches batch numbers case-insensitively", () => {
    const { batches } = applyReceipt(
      [batch()],
      receipt([{ batchNo: " dl001 " }]),
      KNOWN,
    );
    expect(batches).toHaveLength(1);
  });

  it("creates a new batch (listed first) for a new batch number or expiry", () => {
    const { batches } = applyReceipt(
      [batch()],
      receipt([{ batchNo: "NEW9" }, { expiry: "09/27" }]),
      KNOWN,
    );
    expect(batches).toHaveLength(3);
    expect(batches[2].id).toBe("b1"); // existing batch moves below the new ones
    expect(
      batches
        .slice(0, 2)
        .map((b) => b.batchNo)
        .sort(),
    ).toEqual(["DL001", "NEW9"]);
  });

  it("puts LSE medicines into loose units", () => {
    const { batches } = applyReceipt(
      [],
      receipt([{ medicineId: "m30", unit: "LSE", packs: 100 }]),
      KNOWN,
    );
    expect(batches[0]).toMatchObject({ qtyStrip: 0, qtyLoose: 100 });
  });

  it("never mutates its input", () => {
    const input = [batch()];
    const snapshot = JSON.stringify(input);
    applyReceipt(input, receipt([{}]), KNOWN);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it.each([
    [{ medicineId: "m404" }, /unknown medicine/],
    [{ batchNo: "<script>" }, /invalid batch/],
    [{ expiry: "31/12" }, /MM\/YY/],
    [{ packs: 0 }, /quantity/],
    [{ packs: 2.5 }, /quantity/],
    [{ mrp: -1 }, /MRP/],
    [{ costPerPack: Number.NaN }, /cost/],
  ])("rejects invalid line %o", (line, message) => {
    expect(() => applyReceipt([], receipt([line]), KNOWN)).toThrow(message);
  });

  it("rejects the whole receipt if any line is invalid (all-or-nothing)", () => {
    expect(() =>
      applyReceipt([batch()], receipt([{}, { medicineId: "m404" }]), KNOWN),
    ).toThrow(StockError);
  });
});

describe("applyAdjustment", () => {
  const now = new Date("2026-10-02T09:00:00Z");

  it("logs the difference as a movement", () => {
    const result = applyAdjustment(
      batch(),
      { qtyStrip: 7, qtyLoose: 3 },
      "Damaged",
      now,
    );
    expect(result?.batch).toMatchObject({ qtyStrip: 7, qtyLoose: 3 });
    expect(result?.movement).toMatchObject({
      type: "adjustment",
      qtyStripDelta: -3,
      qtyLooseDelta: 3,
      note: "Damaged",
    });
  });

  it("returns null when nothing changed", () => {
    expect(
      applyAdjustment(batch(), { qtyStrip: 10, qtyLoose: 0 }, "x", now),
    ).toBeNull();
  });

  it("rejects negative or fractional quantities", () => {
    expect(() =>
      applyAdjustment(batch(), { qtyStrip: -1, qtyLoose: 0 }, "x", now),
    ).toThrow();
    expect(() =>
      applyAdjustment(batch(), { qtyStrip: 1.5, qtyLoose: 0 }, "x", now),
    ).toThrow();
  });
});

describe("summarizeStock", () => {
  it("totals per medicine and finds the nearest expiry with stock", () => {
    const map = summarizeStock([
      batch({ id: "a", qtyStrip: 10, expiry: "08/27" }),
      batch({ id: "b", qtyStrip: 5, qtyLoose: 4, expiry: "12/26" }),
      batch({ id: "c", qtyStrip: 0, expiry: "01/26" }), // empty → ignored for expiry
    ]);
    expect(map.get("m1")).toEqual({
      stockStrip: 15,
      stockLoose: 4,
      nearestExpiry: "12/26",
      batchCount: 2,
    });
  });
});

describe("applyReversal / applyIssue", () => {
  const at = new Date("2026-10-02T09:00:00Z");

  it("undoes a receipt and removes a batch that only that receipt created", () => {
    const r = applyReceipt(
      [batch()],
      receipt([{ batchNo: "NEW1" }, {}]),
      KNOWN,
    );
    const rev = applyReversal(r.batches, r.movements, "pur_1", "Cancelled", at);
    expect(rev.batches.map((b) => b.batchNo)).toEqual(["DL001"]);
    expect(rev.batches[0].qtyStrip).toBe(10); // back to the original 10
    expect(rev.removedBatchIds).toHaveLength(1);
  });

  it("refuses to reverse when the stock is no longer there", () => {
    const r = applyReceipt([], receipt([{ batchNo: "NEW1", packs: 5 }]), KNOWN);
    const sold = r.batches.map((b) => ({ ...b, qtyStrip: 2 }));
    expect(checkReversal(sold, r.movements, "pur_1")).toHaveLength(1);
    expect(() => applyReversal(sold, r.movements, "pur_1", "x", at)).toThrow(
      /only 2 of 5/,
    );
  });

  it("issues from specific batches and never overdraws", () => {
    const out = applyIssue([batch()], {
      refId: "ret_1",
      type: "purchase_return",
      note: "Return",
      at,
      lines: [{ batchId: "b1", unit: "STP", packs: 4 }],
    });
    expect(out.batches[0].qtyStrip).toBe(6);
    expect(out.movements[0]).toMatchObject({
      type: "purchase_return",
      qtyStripDelta: -4,
    });

    expect(() =>
      applyIssue([batch()], {
        refId: "ret_2",
        type: "purchase_return",
        note: "Return",
        at,
        // two lines for one batch must be summed before checking
        lines: [
          { batchId: "b1", unit: "STP", packs: 6 },
          { batchId: "b1", unit: "STP", packs: 6 },
        ],
      }),
    ).toThrow(/only 10/);
  });
});
