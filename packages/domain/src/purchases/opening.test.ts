import { describe, expect, it } from "vitest";
import { buildOpeningDue, isOpeningDue } from "./opening";
import { canCancelPurchase, canEditPurchase, canReturnPurchase } from "./rules";
import { getDuePaise } from "./calc";
import { purchaseReport } from "../reports/reports";

const sup = { id: "s1", name: "Om Sai", gstin: "", creditDays: 30 };
const now = new Date("2026-10-15T10:00:00Z");
const ctx = { returnCount: 0, stockReversible: true };

describe("supplier's old balance (from before MediCare)", () => {
  it("is an invoice without items: payable, nothing else", () => {
    const p = buildOpeningDue(sup, { amountPaise: 48_500_00 }, now);
    expect(isOpeningDue(p)).toBe(true);
    expect(p).toMatchObject({
      invoiceNo: "OPENING",
      invoiceDate: "2026-10-15",
      dueDate: "2026-11-14",
    });
    expect(getDuePaise(p)).toBe(48_500_00);
    expect(canEditPurchase(p, ctx).allowed).toBe(false);
    expect(canReturnPurchase(p).allowed).toBe(false);
    expect(canCancelPurchase(p, ctx).allowed).toBe(true); // a wrong entry
    expect(canCancelPurchase({ ...p, paidPaise: 100 }, ctx).allowed).toBe(
      false,
    );
  });

  it("is not a purchase of the period", () => {
    const p = buildOpeningDue(sup, { amountPaise: 10_000 }, now);
    const r = purchaseReport([p], [], {
      from: new Date(2026, 9, 1),
      to: new Date(2026, 9, 31, 23, 59),
    });
    expect(r.invoiceCount).toBe(0);
    expect(r.netPaise).toBe(0);
  });

  it("refuses nonsense", () => {
    expect(() => buildOpeningDue(sup, { amountPaise: 0 }, now)).toThrow();
    expect(() =>
      buildOpeningDue(sup, { amountPaise: 100, date: "2030-01-01" }, now),
    ).toThrow(/future/);
  });
});
