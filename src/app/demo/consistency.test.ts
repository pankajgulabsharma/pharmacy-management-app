import { useSalesStore } from "@/features/billing/store/useSalesStore";
import { usePurchaseStore } from "@/features/purchases/store/usePurchaseStore";
import { useInventoryStore } from "@/features/inventory/store/useInventoryStore";
import { useMedicineStore } from "@/features/medicines/store/useMedicineStore";
import {
  calcTotals,
  getDuePaise,
  getCreditPaise,
} from "@/features/purchases/utils/calc";
import { calcSaleTotals, priceLine } from "@/features/billing/utils/pricing";
import { presetRange } from "@/features/reports/utils/period";
import {
  salesReport,
  stockReport,
  gstReport,
} from "@/features/reports/utils/reports";
import { isSameDay } from "@/lib/date";
import { summarizeStock } from "@/features/inventory/utils/ledger";

const { sales, saleReturns } = useSalesStore.getState();
const { purchases, returns } = usePurchaseStore.getState();
const { batches, movements } = useInventoryStore.getState();
const medicines = useMedicineStore.getState().medicines;
import { describe, expect, it } from "vitest";

/**
 * Cross-screen consistency: every number on every screen must agree with
 * the raw data and with the other screens. Runs on the full demo data.
 */
const issues: string[] = [];
const check = (ok: boolean, msg: string) => {
  if (!ok) issues.push(msg);
};

// A) every bill adds up
for (const s of sales) {
  const t = calcSaleTotals(s.lines);
  check(
    t.netPaise === s.totals.netPaise && t.gstPaise === s.totals.gstPaise,
    `Bill ${s.billNo}: stored totals ≠ lines`,
  );
  for (const l of s.lines) {
    const p = priceLine(
      l.allocations,
      l.unitsPerStrip,
      l.discountPercent,
      l.gstPercent,
    );
    check(
      p.amountPaise === l.amountPaise,
      `Bill ${s.billNo} ${l.medicineName}: line amount mismatch`,
    );
    check(
      l.taxablePaise + l.gstPaise === l.amountPaise,
      `Bill ${s.billNo}: taxable+GST ≠ amount`,
    );
    for (const a of l.allocations)
      check(a.ratePaise <= a.mrpPaise, `Bill ${s.billNo}: sold above MRP`);
  }
  check(
    s.totals.cgstPaise + s.totals.sgstPaise === s.totals.gstPaise,
    `Bill ${s.billNo}: CGST+SGST ≠ GST`,
  );
  const refunds = saleReturns
    .filter((r) => r.saleId === s.id)
    .reduce((a, r) => a + r.refundPaise, 0);
  check(
    refunds === s.returnedPaise,
    `Bill ${s.billNo}: returnedPaise ${s.returnedPaise} ≠ refunds ${refunds}`,
  );
  check(
    s.returnedPaise <= s.totals.netPaise,
    `Bill ${s.billNo}: refunded more than billed`,
  );
}
// B) every purchase adds up; returns recorded on the invoice
for (const p of purchases) {
  const t = calcTotals(p.lines);
  check(
    t.netPaise === p.totals.netPaise,
    `Purchase ${p.invoiceNo}: stored total ≠ lines (${t.netPaise} vs ${p.totals.netPaise})`,
  );
  const dn = returns
    .filter((r) => r.purchaseId === p.id)
    .reduce((a, r) => a + r.totalPaise, 0);
  check(
    dn === p.returnedPaise,
    `Purchase ${p.invoiceNo}: returnedPaise ${p.returnedPaise} ≠ debit notes ${dn}`,
  );
  check(
    getDuePaise(p) >= 0 && getCreditPaise(p) >= 0,
    `Purchase ${p.invoiceNo}: negative due/credit`,
  );
}
// C) stock ledger: movements add up to the shelf, per batch
for (const b of batches) {
  const mv = movements.filter((m) => m.batchId === b.id);
  const s = mv.reduce((a, m) => a + m.qtyStripDelta, 0),
    l = mv.reduce((a, m) => a + m.qtyLooseDelta, 0);
  check(
    s === b.qtyStrip && l === b.qtyLoose,
    `Batch ${b.batchNo}: history ${s}+${l}L ≠ shelf ${b.qtyStrip}+${b.qtyLoose}L`,
  );
  check(
    b.qtyStrip >= 0 && b.qtyLoose >= 0,
    `Batch ${b.batchNo}: negative stock`,
  );
}
// D) Today: Billing bar formula vs Dashboard/Reports formula
const now = new Date();
const barToday = sales
  .filter((s) => isSameDay(new Date(s.createdAt), now))
  .reduce((a, s) => a + s.totals.netPaise - s.returnedPaise, 0);
const rep = salesReport(sales, saleReturns, batches, presetRange("today"));
check(
  barToday === rep.netAfterReturnsPaise,
  `Today's sales: Billing bar ₹${barToday / 100} ≠ Dashboard/Reports ₹${rep.netAfterReturnsPaise / 100}`,
);
// E) Inventory footer value (rupee floats) vs Reports stock value (paise)
const meds = new Map(medicines.map((m) => [m.id, m]));
let invValue = 0;
for (const b of batches) {
  const m = meds.get(b.medicineId)!;
  const ups = m.unitsPerStrip > 0 ? m.unitsPerStrip : 1;
  invValue +=
    (m.unit === "LSE" ? b.qtyLoose : b.qtyStrip + b.qtyLoose / ups) *
    b.purchasePrice;
}
const st = stockReport(batches, medicines, 90);
check(
  Math.round(invValue * 100) === st.costValuePaise,
  `Stock value: Inventory ₹${invValue.toFixed(2)} ≠ Reports ₹${(st.costValuePaise / 100).toFixed(2)}`,
);
// F) Inventory "Sale" column vs what billing actually charges
let above = 0;
for (const b of batches) {
  const m = meds.get(b.medicineId)!;
  if (m.salePrice > b.mrp && (b.qtyStrip || b.qtyLoose)) above++;
}
check(
  above === 0,
  `${above} batch(es): Inventory shows master sale price ABOVE the batch MRP (billing charges the MRP)`,
);
// G) GST: output in report = GST inside bills − GST inside refunds
const all = { from: new Date(2000, 0, 1), to: new Date(2100, 0, 1) };
const g = gstReport(sales, saleReturns, purchases, returns, all);
check(
  g.netPayablePaise === g.outGstPaise - g.inGstPaise,
  "GST: net ≠ out − in",
);
// H) Medicines stock column = Σ batches
const sum = summarizeStock(batches);
for (const m of medicines) {
  const x = sum.get(m.id);
  const s = batches
    .filter((b) => b.medicineId === m.id)
    .reduce((a, b) => a + b.qtyStrip, 0);
  check((x?.stockStrip ?? 0) === s, `${m.name}: Medicines stock ≠ Σ batches`);
}
describe("numbers agree across all screens", () => {
  it("bills, purchases, stock ledger, today's sales, valuation, GST and stock columns", () => {
    expect(issues).toEqual([]);
    expect(sales.length).toBeGreaterThan(100);
  });
});
