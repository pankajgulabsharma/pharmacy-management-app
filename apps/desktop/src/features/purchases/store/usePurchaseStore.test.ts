import { beforeEach, describe, expect, it } from "vitest";
import { useInventoryStore } from "@/features/inventory/store/useInventoryStore";
import type { Purchase } from "@medicare/domain/purchases/types";
import { getCreditPaise, getDuePaise } from "@medicare/domain/purchases/calc";
import { getReturnableLines } from "@medicare/domain/purchases/returns";
import {
  PurchaseError,
  getRuleContext,
  usePurchaseStore,
} from "./usePurchaseStore";

const initialInventory = useInventoryStore.getState();
const initialPurchases = usePurchaseStore.getState();

beforeEach(() => {
  useInventoryStore.setState(initialInventory, true);
  usePurchaseStore.setState(initialPurchases, true);
});

const inv = () => useInventoryStore.getState();
const store = () => usePurchaseStore.getState();

/** A fresh, unpaid invoice based on demo data, with unique batches */
function newPurchase(over: Partial<Purchase> = {}): Purchase {
  const base = store().purchases.find((p) => p.stockPosted)!;
  return {
    ...base,
    id: "pur_test",
    invoiceNo: "TEST-001",
    paidPaise: 0,
    returnedPaise: 0,
    revision: 1,
    lines: base.lines.map((l, i) => ({
      ...l,
      id: `tl${i}`,
      batchNo: `TEST${i}`,
    })),
    ...over,
  };
}

function batchQty(batchNo: string) {
  const b = inv().batches.find((x) => x.batchNo === batchNo);
  return b ? b.qtyStrip + b.qtyLoose : null;
}

describe("demo seed", () => {
  it("posts stock for the newest invoices and keeps history read-only", () => {
    const posted = store().purchases.filter((p) => p.stockPosted);
    expect(posted.length).toBe(8);
    for (const p of posted) expect(inv().receivedRefs[p.id]).toBe(true);
    expect(store().returns.length).toBe(2);
  });
});

describe("addPurchase", () => {
  it("saves the invoice AND adds billed + free packs to inventory", () => {
    const p = newPurchase();
    const packs = store().addPurchase(p);
    expect(packs).toBe(p.lines.reduce((s, l) => s + l.qty + l.freeQty, 0));
    expect(batchQty("TEST0")).toBe(p.lines[0].qty + p.lines[0].freeQty);
  });

  it("rejects a duplicate invoice for the same supplier and adds no stock", () => {
    store().addPurchase(newPurchase());
    const batches = inv().batches;
    expect(() =>
      store().addPurchase(
        newPurchase({ id: "pur_other", invoiceNo: "test-001" }),
      ),
    ).toThrow(PurchaseError);
    expect(inv().batches).toBe(batches);
  });

  it("saves nothing when stock can't be received (all-or-nothing)", () => {
    const bad = newPurchase();
    bad.lines = [{ ...bad.lines[0], medicineId: "does-not-exist" }];
    const count = store().purchases.length;
    expect(() => store().addPurchase(bad)).toThrow(/unknown medicine/);
    expect(store().purchases).toHaveLength(count);
  });
});

describe("updatePurchase (edit)", () => {
  it("re-posts stock: old quantities out, new quantities in", () => {
    const p = newPurchase();
    store().addPurchase(p);
    const edited: Purchase = {
      ...p,
      revision: 2,
      lines: [{ ...p.lines[0], qty: 3, freeQty: 0 }],
    };
    store().updatePurchase(edited);

    expect(batchQty("TEST0")).toBe(3);
    expect(batchQty("TEST1")).toBeNull(); // line removed → its new batch disappears
    expect(store().purchases.find((x) => x.id === p.id)?.revision).toBe(2);
  });

  it("is blocked once part of the stock is gone", () => {
    const p = newPurchase();
    store().addPurchase(p);
    const b = inv().batches.find((x) => x.batchNo === "TEST0")!;
    inv().adjust(b.id, { qtyStrip: 0, qtyLoose: 0 }, "Damaged");

    expect(() => store().updatePurchase({ ...p, revision: 2 })).toThrow(
      /sold or adjusted/,
    );
  });

  it("rejects a stale revision (edited elsewhere)", () => {
    const p = newPurchase();
    store().addPurchase(p);
    expect(() => store().updatePurchase({ ...p, revision: 5 })).toThrow(
      /changed elsewhere/,
    );
  });

  it("refuses to edit imported history", () => {
    const history = store().purchases.find((x) => !x.stockPosted)!;
    expect(() =>
      store().updatePurchase({ ...history, revision: history.revision + 1 }),
    ).toThrow(/Imported history/);
  });
});

describe("cancelPurchase", () => {
  it("takes the stock back out and keeps the invoice as Cancelled", () => {
    const p = newPurchase();
    store().addPurchase(p);
    store().cancelPurchase(p.id, "Duplicate entry");

    expect(batchQty("TEST0")).toBeNull();
    const saved = store().purchases.find((x) => x.id === p.id)!;
    expect(saved.status).toBe("cancelled");
    expect(saved.cancelReason).toBe("Duplicate entry");
    expect(getDuePaise(saved)).toBe(0);
    expect(inv().movements[0].type).toBe("purchase_reversal");
  });

  it("is blocked when a payment is recorded", () => {
    const p = newPurchase();
    store().addPurchase(p);
    store().recordPayment(p.id, 100);
    expect(() => store().cancelPurchase(p.id, "x")).toThrow(
      /payment is recorded/,
    );
  });

  it("requires a reason", () => {
    const p = newPurchase();
    store().addPurchase(p);
    expect(() => store().cancelPurchase(p.id, "   ")).toThrow(/reason/);
  });
});

describe("createReturn (debit note)", () => {
  it("removes stock, reduces what we owe and numbers the note", () => {
    const p = newPurchase();
    store().addPurchase(p);
    const line = p.lines[0];
    const before = batchQty("TEST0")!;

    const ret = store().createReturn({
      purchaseId: p.id,
      date: "2026-10-02",
      reason: "damaged",
      notes: "  crushed  ",
      lines: [{ purchaseLineId: line.id, qty: 2 }],
    });

    expect(ret.returnNo).toMatch(/^DN-\d{4}$/);
    expect(ret.notes).toBe("crushed");
    expect(batchQty("TEST0")).toBe(before - 2);
    const saved = store().purchases.find((x) => x.id === p.id)!;
    expect(saved.returnedPaise).toBe(ret.totalPaise);
    expect(getDuePaise(saved)).toBe(saved.totals.netPaise - ret.totalPaise);
  });

  it("never lets you return more than was bought or is in stock", () => {
    const p = newPurchase();
    store().addPurchase(p);
    const line = p.lines[0];
    const max = getReturnableLines(p, store().returns, inv().batches)[0].max;

    expect(() =>
      store().createReturn({
        purchaseId: p.id,
        date: "2026-10-02",
        reason: "damaged",
        notes: "",
        lines: [{ purchaseLineId: line.id, qty: max + 1 }],
      }),
    ).toThrow(/at most/);
  });

  it("locks edit and cancel once a return exists", () => {
    const p = newPurchase();
    store().addPurchase(p);
    store().createReturn({
      purchaseId: p.id,
      date: "2026-10-02",
      reason: "expired",
      notes: "",
      lines: [{ purchaseLineId: p.lines[0].id, qty: 1 }],
    });
    const saved = store().purchases.find((x) => x.id === p.id)!;
    expect(getRuleContext(saved, store().returns).returnCount).toBe(1);
    expect(() => store().cancelPurchase(p.id, "x")).toThrow(/return was made/);
  });

  it("turns over-payment into supplier credit", () => {
    const p = newPurchase();
    store().addPurchase(p);
    store().recordPayment(p.id, p.totals.netPaise); // fully paid
    const ret = store().createReturn({
      purchaseId: p.id,
      date: "2026-10-02",
      reason: "expired",
      notes: "",
      lines: [{ purchaseLineId: p.lines[0].id, qty: 1 }],
    });
    const saved = store().purchases.find((x) => x.id === p.id)!;
    expect(getDuePaise(saved)).toBe(0);
    expect(getCreditPaise(saved)).toBe(ret.totalPaise);
  });
});

describe("recordPayment", () => {
  it("never accepts more than the balance or invalid amounts", () => {
    const p = newPurchase();
    store().addPurchase(p);
    store().recordPayment(p.id, 10_000);
    expect(() => store().recordPayment(p.id, p.totals.netPaise)).toThrow(
      /more than the balance/,
    );
    expect(() => store().recordPayment(p.id, -5)).toThrow(PurchaseError);
    expect(() => store().recordPayment(p.id, 1.5)).toThrow(PurchaseError);
  });
});
