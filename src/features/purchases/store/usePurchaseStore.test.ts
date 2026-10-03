import { beforeEach, describe, expect, it } from "vitest";
import { useInventoryStore } from "@/features/inventory/store/useInventoryStore";
import { mockPurchases } from "../data/mockPurchases";
import type { Purchase } from "../types";
import { PurchaseError, usePurchaseStore } from "./usePurchaseStore";

const initialInventory = useInventoryStore.getState();
const initialPurchases = usePurchaseStore.getState();

beforeEach(() => {
  useInventoryStore.setState(initialInventory, true);
  usePurchaseStore.setState(initialPurchases, true);
});

/** A fresh invoice based on demo data, with unique ids */
function newPurchase(over: Partial<Purchase> = {}): Purchase {
  const base = mockPurchases[0];
  return {
    ...base,
    id: "pur_test",
    invoiceNo: "TEST-001",
    lines: base.lines.map((l, i) => ({
      ...l,
      id: `l${i}`,
      batchNo: `TEST${i}`,
    })),
    ...over,
  };
}

function packsOf(medicineId: string) {
  return useInventoryStore
    .getState()
    .batches.filter((b) => b.medicineId === medicineId)
    .reduce((sum, b) => sum + b.qtyStrip + b.qtyLoose, 0);
}

describe("addPurchase", () => {
  it("saves the invoice AND adds billed + free packs to inventory", () => {
    const p = newPurchase();
    const line = p.lines[0];
    const before = packsOf(line.medicineId);

    const packs = usePurchaseStore.getState().addPurchase(p);

    const expected = p.lines.reduce((s, l) => s + l.qty + l.freeQty, 0);
    expect(packs).toBe(expected);
    expect(packsOf(line.medicineId)).toBeGreaterThanOrEqual(
      before + line.qty + line.freeQty,
    );
    expect(usePurchaseStore.getState().purchases[0].id).toBe("pur_test");
    expect(useInventoryStore.getState().movements[0]).toMatchObject({
      type: "purchase",
      refId: "pur_test",
    });
  });

  it("rejects a duplicate invoice for the same supplier and adds no stock", () => {
    const first = newPurchase();
    usePurchaseStore.getState().addPurchase(first);
    const batchesAfterFirst = useInventoryStore.getState().batches;

    expect(() =>
      usePurchaseStore
        .getState()
        .addPurchase(newPurchase({ id: "pur_other", invoiceNo: "test-001" })),
    ).toThrow(PurchaseError);
    expect(useInventoryStore.getState().batches).toBe(batchesAfterFirst);
  });

  it("saves nothing when stock can't be received (all-or-nothing)", () => {
    const bad = newPurchase();
    bad.lines = [{ ...bad.lines[0], medicineId: "does-not-exist" }];
    const count = usePurchaseStore.getState().purchases.length;
    const batches = useInventoryStore.getState().batches;

    expect(() => usePurchaseStore.getState().addPurchase(bad)).toThrow(
      /unknown medicine/,
    );
    expect(usePurchaseStore.getState().purchases).toHaveLength(count);
    expect(useInventoryStore.getState().batches).toBe(batches);
  });

  it("never receives the same document twice", () => {
    const p = newPurchase();
    const receipt = { refId: p.id, note: "x", at: new Date(), lines: [] };
    usePurchaseStore.getState().addPurchase(p);
    expect(useInventoryStore.getState().receive(receipt)).toBe(0);
  });
});

describe("recordPayment", () => {
  it("adds a payment but never more than the balance", () => {
    const p = newPurchase({ paidPaise: 0 });
    usePurchaseStore.getState().addPurchase(p);
    const { recordPayment } = usePurchaseStore.getState();

    recordPayment(p.id, 10_000);
    expect(usePurchaseStore.getState().purchases[0].paidPaise).toBe(10_000);
    expect(() => recordPayment(p.id, p.totals.netPaise)).toThrow(
      /more than the balance/,
    );
    expect(() => recordPayment(p.id, -5)).toThrow(PurchaseError);
    expect(() => recordPayment(p.id, 1.5)).toThrow(PurchaseError);
  });
});
