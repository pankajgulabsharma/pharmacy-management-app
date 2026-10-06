import { beforeEach, describe, expect, it } from "vitest";
import { useInventoryStore } from "@/features/inventory/store/useInventoryStore";
import { useMedicineStore } from "@/features/medicines/store/useMedicineStore";
import { EMPTY_PAYMENT, type SaleInput } from "@medicare/domain/billing/types";
import { sellableBatches, stockLimits } from "@medicare/domain/billing/allocate";
import { useSalesStore } from "./useSalesStore";

const initialInventory = useInventoryStore.getState();
const initialSales = useSalesStore.getState();

beforeEach(() => {
  useInventoryStore.setState(initialInventory, true);
  useSalesStore.setState(initialSales, true);
});

const inv = () => useInventoryStore.getState();
const store = () => useSalesStore.getState();

/** First active strip medicine that has at least 3 sellable strips */
function stocked() {
  const now = new Date();
  for (const m of useMedicineStore.getState().medicines) {
    if (m.status !== "active" || m.unit !== "STP") continue;
    const lim = stockLimits(sellableBatches(inv().batches, m.id, now), m, 0);
    if (lim.maxStrip >= 3) return { m, lim };
  }
  throw new Error("no stocked medicine in demo data");
}

function strips(medicineId: string) {
  return inv()
    .batches.filter((b) => b.medicineId === medicineId)
    .reduce((s, b) => s + b.qtyStrip, 0);
}

function sale(medicineId: string, qtyStrip: number): SaleInput {
  return {
    cart: [
      { lineId: "c", medicineId, qtyStrip, qtyLoose: 0, discountPercent: 0 },
    ],
    customerName: "Test",
    doctor: "",
    counter: "Counter 1",
    payment: { ...EMPTY_PAYMENT, method: "upi" },
  };
}

describe("demo seed", () => {
  it("has sales, a sales return and a held bill", () => {
    expect(store().sales.length).toBeGreaterThan(10);
    // one cash refund + one adjusted in a customer's udhaar khata
    expect(store().saleReturns).toHaveLength(2);
    expect(
      store().saleReturns.some((r) => r.refundMode === "udhaar_adjust"),
    ).toBe(true);
    expect(store().held).toHaveLength(1);
    for (const s of store().sales) expect(s.billNo).toMatch(/^INV-\d{4}$/);
  });
});

describe("completeSale", () => {
  it("takes the stock out and saves a numbered bill", () => {
    const { m } = stocked();
    const before = strips(m.id);
    const nextNo = store().sales.length + 1;
    const s = store().completeSale(sale(m.id, 2));
    expect(s.billNo).toBe(`INV-${String(nextNo).padStart(4, "0")}`);
    expect(strips(m.id)).toBe(before - 2);
    expect(inv().movements[0]).toMatchObject({ type: "sale", refId: s.id });
  });

  it("changes nothing when stock is short (all-or-nothing)", () => {
    const { m, lim } = stocked();
    const batches = inv().batches;
    const count = store().sales.length;
    expect(() => store().completeSale(sale(m.id, lim.maxStrip + 1))).toThrow(
      /not enough stock/,
    );
    expect(inv().batches).toBe(batches);
    expect(store().sales).toHaveLength(count);
  });
});

describe("sales return", () => {
  it("puts stock back and records the refund on the bill", () => {
    const { m } = stocked();
    const s = store().completeSale(sale(m.id, 2));
    const afterSale = strips(m.id);
    const ret = store().createSaleReturn({
      saleId: s.id,
      reason: "Wrong medicine",
      refundMode: "cash",
      notes: "",
      lines: [{ saleLineId: s.lines[0].id, qtyStrip: 1, qtyLoose: 0 }],
    });
    expect(ret.returnNo).toMatch(/^SR-\d{4}$/);
    expect(strips(m.id)).toBe(afterSale + 1);
    expect(store().sales.find((x) => x.id === s.id)?.returnedPaise).toBe(
      ret.refundPaise,
    );
  });
});

describe("held bills", () => {
  it("holds and takes back a cart without touching stock", () => {
    const { m } = stocked();
    const batches = inv().batches;
    const h = store().holdBill({
      customerName: "  Asha  ",
      doctor: "",
      counter: "Counter 2",
      lines: sale(m.id, 1).cart,
    });
    expect(h.customerName).toBe("Asha");
    expect(inv().batches).toBe(batches);
    expect(store().takeHeld(h.id).lines).toHaveLength(1);
    expect(store().held.find((x) => x.id === h.id)).toBeUndefined();
  });
});

describe("today's sales after a return", () => {
  it("a refund counts on the day the money goes back, not on the bill's day", async () => {
    const { salesReport } = await import("@medicare/domain/reports/reports");
    const { presetRange } = await import("@medicare/domain/reports/period");
    const old = store().sales.find(
      (s) =>
        !s.imported &&
        new Date(s.createdAt).toDateString() !== new Date().toDateString() &&
        s.lines.some((l) => l.qtyStrip > 0) &&
        s.returnedPaise === 0,
    )!;
    const before = salesReport(
      store().sales,
      store().saleReturns,
      inv().batches,
      presetRange("today"),
    ).netAfterReturnsPaise;
    const ret = store().createSaleReturn({
      saleId: old.id,
      reason: "Wrong medicine",
      refundMode: "cash",
      notes: "",
      lines: [
        {
          saleLineId: old.lines.find((l) => l.qtyStrip > 0)!.id,
          qtyStrip: 1,
          qtyLoose: 0,
        },
      ],
    });
    const after = salesReport(
      store().sales,
      store().saleReturns,
      inv().batches,
      presetRange("today"),
    ).netAfterReturnsPaise;
    expect(after).toBe(before - ret.refundPaise);
  });
});
