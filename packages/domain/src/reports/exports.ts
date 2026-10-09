/**
 * CSV layouts for every report — shared by the Export button and any
 * offline export, so the files are always identical.
 */
import type { StockBatch } from "../inventory/types";
import type { Medicine } from "../medicines/types";
import { PAYMENT_METHOD_LABELS, type Sale } from "../billing/types";
import { toCsv } from "../lib/csv";
import { batchCostPaise, batchMrpPaise } from "../inventory/stock";
import { splitCgstSgst } from "../lib/gst";
import { inRange, type DateRange } from "./period";
import type { GstReport, PurchaseReport } from "./reports";

const rupees = (paise: number) => (paise / 100).toFixed(2);

const dateTime = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Every bill in the period */
export function salesCsv(sales: readonly Sale[], range: DateRange): string {
  const bills = sales
    .filter((s) => inRange(s.createdAt, range))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return toCsv(bills, [
    { header: "Bill no", value: (s) => s.billNo },
    {
      header: "Date & time",
      value: (s) => dateTime.format(new Date(s.createdAt)),
    },
    { header: "Customer", value: (s) => s.customerName },
    { header: "Doctor", value: (s) => s.doctor },
    { header: "Counter", value: (s) => s.counter },
    { header: "Billed by", value: (s) => s.billedBy ?? "" },
    {
      header: "Payment",
      value: (s) => PAYMENT_METHOD_LABELS[s.payment.method],
    },
    { header: "Items", value: (s) => s.lines.length },
    { header: "Taxable (Rs)", value: (s) => rupees(s.totals.taxablePaise) },
    { header: "CGST (Rs)", value: (s) => rupees(s.totals.cgstPaise) },
    { header: "SGST (Rs)", value: (s) => rupees(s.totals.sgstPaise) },
    { header: "Discount (Rs)", value: (s) => rupees(s.totals.discountPaise) },
    { header: "Total (Rs)", value: (s) => rupees(s.totals.netPaise) },
    { header: "Returned (Rs)", value: (s) => rupees(s.returnedPaise) },
    {
      header: "Source",
      value: (s) => (s.imported ? "Imported history" : "This app"),
    },
  ]);
}

/** Purchases grouped by supplier for the period */
export function purchasesCsv(r: PurchaseReport): string {
  return toCsv(r.bySupplier, [
    { header: "Supplier", value: (s) => s.name },
    { header: "Invoices", value: (s) => s.invoices },
    { header: "Amount (Rs)", value: (s) => rupees(s.amountPaise) },
    { header: "Outstanding (Rs)", value: (s) => rupees(s.outstandingPaise) },
  ]);
}

/** GST by slab, CGST and SGST shown separately */
export function gstCsv(r: GstReport): string {
  return toCsv(r.rows, [
    { header: "GST slab %", value: (x) => x.rate },
    { header: "Sales taxable (Rs)", value: (x) => rupees(x.outTaxablePaise) },
    { header: "Output IGST (Rs)", value: (x) => rupees(x.outIgstPaise) },
    {
      header: "Output CGST (Rs)",
      value: (x) =>
        rupees(splitCgstSgst(x.outGstPaise - x.outIgstPaise).cgstPaise),
    },
    {
      header: "Output SGST (Rs)",
      value: (x) =>
        rupees(splitCgstSgst(x.outGstPaise - x.outIgstPaise).sgstPaise),
    },
    { header: "Purchase taxable (Rs)", value: (x) => rupees(x.inTaxablePaise) },
    {
      header: "Input CGST (Rs)",
      value: (x) => rupees(splitCgstSgst(x.inGstPaise).cgstPaise),
    },
    {
      header: "Input SGST (Rs)",
      value: (x) => rupees(splitCgstSgst(x.inGstPaise).sgstPaise),
    },
    {
      header: "Net payable (Rs; negative = credit)",
      value: (x) => rupees(x.outGstPaise - x.inGstPaise),
    },
  ]);
}

/** Every batch in stock, with value at cost and at MRP */
export function stockCsv(
  batches: readonly StockBatch[],
  medicines: readonly Medicine[],
): string {
  const byId = new Map(medicines.map((m) => [m.id, m]));
  const rows = batches
    .filter((b) => (b.qtyStrip > 0 || b.qtyLoose > 0) && byId.has(b.medicineId))
    .map((b) => {
      const m = byId.get(b.medicineId)!;
      // Same valuation as the Inventory screen and the Stock report
      return {
        b,
        m,
        costPaise: batchCostPaise(b, m),
        mrpPaise: batchMrpPaise(b, m),
      };
    })
    .sort((x, y) => x.m.name.localeCompare(y.m.name));
  return toCsv(rows, [
    { header: "Medicine", value: (r) => r.m.name },
    { header: "Pack", value: (r) => r.m.unit },
    { header: "Batch", value: (r) => r.b.batchNo },
    { header: "Expiry (MM/YY)", value: (r) => r.b.expiry },
    { header: "Packs", value: (r) => r.b.qtyStrip },
    { header: "Loose units", value: (r) => r.b.qtyLoose },
    { header: "Rack", value: (r) => r.m.rack },
    {
      header: "Cost per pack (Rs)",
      value: (r) => r.b.purchasePrice.toFixed(2),
    },
    { header: "MRP per pack (Rs)", value: (r) => r.b.mrp.toFixed(2) },
    {
      header: "Value at cost (Rs)",
      value: (r) => rupees(r.costPaise),
    },
    { header: "Value at MRP (Rs)", value: (r) => rupees(r.mrpPaise) },
  ]);
}
