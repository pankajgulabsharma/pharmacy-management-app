import { describe, expect, it } from "vitest";
import { useSalesStore } from "@/features/billing/store/useSalesStore";
import { usePurchaseStore } from "@/features/purchases/store/usePurchaseStore";
import { useInventoryStore } from "@/features/inventory/store/useInventoryStore";
import { useMedicineStore } from "@/features/medicines/store/useMedicineStore";
import { customRange, presetRange } from "@medicare/domain/reports/period";
import {
  gstReport,
  purchaseReport,
  salesInsights,
  salesReport,
  stockReport,
} from "@medicare/domain/reports/reports";

const ALL = { from: new Date(2000, 0, 1), to: new Date(2100, 0, 1) };
const sales = useSalesStore.getState().sales;
const saleReturns = useSalesStore.getState().saleReturns;
const { purchases, returns: debitNotes } = usePurchaseStore.getState();
const { batches } = useInventoryStore.getState();
const medicines = useMedicineStore.getState().medicines;

describe("periods", () => {
  const now = new Date(2026, 9, 15, 14, 30); // 15 Oct 2026
  it("last month is the full previous calendar month", () => {
    const r = presetRange("lastMonth", now);
    expect([
      r.from.getDate(),
      r.from.getMonth(),
      r.to.getDate(),
      r.to.getMonth(),
    ]).toEqual([1, 8, 30, 8]);
  });
  it("last 7 days includes today", () => {
    const r = presetRange("7d", now);
    expect(r.from.getDate()).toBe(9);
    expect(r.to.getDate()).toBe(15);
  });
  it("rejects a custom range that ends before it starts", () => {
    expect(customRange("2026-10-10", "2026-10-01")).toBeNull();
  });
});

describe("sales report", () => {
  const r = salesReport(sales, saleReturns, batches, ALL);
  const total = sales.reduce((s, x) => s + x.totals.netPaise, 0);

  it("totals match the bills", () => {
    expect(r.billCount).toBe(sales.length);
    expect(r.netPaise).toBe(total);
    expect(r.netAfterReturnsPaise).toBe(
      total - saleReturns.reduce((s, x) => s + x.refundPaise, 0),
    );
  });
  it("payment-mode split adds up to the total", () => {
    expect(r.byPayment.reduce((s, p) => s + p.amountPaise, 0)).toBe(total);
  });
  it("top medicines are sorted by amount", () => {
    const amounts = r.topMedicines.map((m) => m.amountPaise);
    expect(amounts).toEqual([...amounts].sort((a, b) => b - a));
  });
  it("daily totals add up for a dated range", () => {
    const week = presetRange("7d");
    const w = salesReport(sales, saleReturns, batches, week);
    expect(w.daily.reduce((s, d) => s + d.amountPaise, 0)).toBe(w.netPaise);
  });
});

describe("GST report", () => {
  const g = gstReport(sales, saleReturns, purchases, debitNotes, ALL);
  it("output GST is the GST inside the bills, minus returns", () => {
    const billGst = sales.reduce((s, x) => s + x.totals.gstPaise, 0);
    expect(g.outGstPaise).toBeLessThanOrEqual(billGst);
    expect(g.outGstPaise).toBeGreaterThan(0);
  });
  it("net payable = output − input", () => {
    expect(g.netPayablePaise).toBe(g.outGstPaise - g.inGstPaise);
  });
});

describe("purchase report", () => {
  it("ignores cancelled invoices", () => {
    const p = purchaseReport(purchases, debitNotes, ALL);
    expect(p.invoiceCount).toBe(
      purchases.filter((x) => x.status !== "cancelled").length,
    );
    expect(p.bySupplier.reduce((s, x) => s + x.amountPaise, 0)).toBe(
      p.netPaise,
    );
  });
});

describe("purchases by day", () => {
  it("adds up to the period total", () => {
    const p = purchaseReport(purchases, debitNotes, presetRange("30d"));
    expect(p.daily.reduce((s, d) => s + d.amountPaise, 0)).toBe(p.netPaise);
  });
});

describe("stock report", () => {
  const s = stockReport(batches, medicines, 90);
  it("values add up by category", () => {
    expect(s.byCategory.reduce((a, c) => a + c.costPaise, 0)).toBe(
      s.costValuePaise,
    );
  });
  it("lists the expired demo batch (Telma, 01/26)", () => {
    expect(s.expired.some((e) => e.expiry === "01/26")).toBe(true);
  });
  it("MRP value is never below cost value for demo stock", () => {
    expect(s.mrpValuePaise).toBeGreaterThan(s.costValuePaise);
  });
});

describe("sales insights", () => {
  const r = salesReport(sales, saleReturns, batches, presetRange("90d"));
  const i = salesInsights(r.daily);

  it("finds the weekday pattern built into the demo history", () => {
    expect(i.busiestWeekday).toBe(1); // Monday
    expect(i.quietestWeekday).toBe(0); // Sunday
  });
  it("sees the salary-day lift and the seasonal rise", () => {
    expect(i.salaryLiftPct).toBeGreaterThan(5);
    expect(i.trendPct).toBeGreaterThan(0);
  });
  it("does not invent patterns from too little data", () => {
    const week = salesInsights(
      salesReport(sales, saleReturns, batches, presetRange("today")).daily,
    );
    expect(week.busiestWeekday).toBeNull();
    expect(week.trendPct).toBeNull();
  });
});
