/**
 * Report calculations — pure functions over the same data the screens use.
 * All money is integer paise. Ready to move to the server unchanged.
 */
import type { StockBatch } from "../inventory/types";
import { CATEGORY_LABELS, type Medicine } from "../medicines/types";
import type { Sale, SaleReturn, PaymentMethod } from "../billing/types";
import type { Purchase, PurchaseReturn } from "../purchases/types";
import { calcLine, getDuePaise } from "../purchases/calc";
import { GST_RATES, splitInclusive } from "../lib/gst";
import { compareExpiry, isExpiringWithin, isExpiryPast } from "../lib/expiry";
import { toISODate } from "../lib/date";
import { rupeesToPaise, type Paise } from "../lib/money";
import { batchCostPaise, batchMrpPaise } from "../inventory/stock";
import { daysIn, inRange, type DateRange } from "./period";

/* ------------------------------------------------------------------ */
/* Sales                                                              */
/* ------------------------------------------------------------------ */

export type SalesReport = {
  billCount: number;
  grossPaise: Paise;
  discountPaise: Paise;
  netPaise: Paise;
  returnsPaise: Paise;
  /** Net sales after customer refunds */
  netAfterReturnsPaise: Paise;
  avgBillPaise: Paise;
  /** Landed cost of goods sold (approximate — current batch cost) */
  costPaise: Paise;
  /** Net sales − cost of goods (approximate) */
  marginPaise: Paise;
  byPayment: { method: PaymentMethod; bills: number; amountPaise: Paise }[];
  daily: { date: string; amountPaise: Paise; count: number }[];
  topMedicines: {
    medicineId: string;
    name: string;
    unit: string;
    qtyStrip: number;
    qtyLoose: number;
    amountPaise: Paise;
  }[];
};

export function salesReport(
  sales: readonly Sale[],
  saleReturns: readonly SaleReturn[],
  batches: readonly StockBatch[],
  range: DateRange,
): SalesReport {
  const costOf = new Map(batches.map((b) => [b.id, b.purchasePrice]));
  const inPeriod = sales.filter((s) => inRange(s.createdAt, range));
  const days = new Map(
    daysIn(range).map((d) => [d, { amountPaise: 0, count: 0 }]),
  );
  const pay = new Map<PaymentMethod, { bills: number; amountPaise: number }>();
  const meds = new Map<string, SalesReport["topMedicines"][number]>();

  let gross = 0;
  let discount = 0;
  let net = 0;
  let cost = 0;

  for (const s of inPeriod) {
    gross += s.totals.grossPaise;
    discount += s.totals.discountPaise;
    net += s.totals.netPaise;

    const day = days.get(toISODate(new Date(s.createdAt)));
    if (day) {
      day.amountPaise += s.totals.netPaise;
      day.count++;
    }

    const p = pay.get(s.payment.method) ?? { bills: 0, amountPaise: 0 };
    p.bills++;
    p.amountPaise += s.totals.netPaise;
    pay.set(s.payment.method, p);

    for (const l of s.lines) {
      const m = meds.get(l.medicineId) ?? {
        medicineId: l.medicineId,
        name: l.medicineName,
        unit: l.unit,
        qtyStrip: 0,
        qtyLoose: 0,
        amountPaise: 0,
      };
      m.qtyStrip += l.qtyStrip;
      m.qtyLoose += l.qtyLoose;
      m.amountPaise += l.amountPaise;
      meds.set(l.medicineId, m);

      for (const a of l.allocations) {
        const packs = a.qtyStrip + a.qtyLoose / l.unitsPerStrip;
        cost += Math.round(packs * rupeesToPaise(costOf.get(a.batchId) ?? 0));
      }
    }
  }

  const returns = saleReturns
    .filter((r) => inRange(r.createdAt, range))
    .reduce((sum, r) => sum + r.refundPaise, 0);
  const netAfter = net - returns;

  return {
    billCount: inPeriod.length,
    grossPaise: gross,
    discountPaise: discount,
    netPaise: net,
    returnsPaise: returns,
    netAfterReturnsPaise: netAfter,
    avgBillPaise: inPeriod.length ? Math.round(net / inPeriod.length) : 0,
    costPaise: cost,
    marginPaise: net - cost,
    byPayment: [...pay.entries()]
      .map(([method, v]) => ({ method, ...v }))
      .sort((a, b) => b.amountPaise - a.amountPaise),
    daily: [...days.entries()].map(([date, v]) => ({ date, ...v })),
    topMedicines: [...meds.values()]
      .sort((a, b) => b.amountPaise - a.amountPaise)
      .slice(0, 10),
  };
}

/* ------------------------------------------------------------------ */
/* Purchases                                                          */
/* ------------------------------------------------------------------ */

export type PurchaseReport = {
  invoiceCount: number;
  netPaise: Paise;
  gstPaise: Paise;
  paidPaise: Paise;
  outstandingPaise: Paise;
  debitNotesPaise: Paise;
  daily: { date: string; amountPaise: Paise; count: number }[];
  bySupplier: {
    supplierId: string;
    name: string;
    invoices: number;
    amountPaise: Paise;
    outstandingPaise: Paise;
  }[];
};

export function purchaseReport(
  purchases: readonly Purchase[],
  debitNotes: readonly PurchaseReturn[],
  range: DateRange,
): PurchaseReport {
  const active = purchases.filter(
    (p) => p.status !== "cancelled" && inRange(p.invoiceDate, range),
  );
  const bySupplier = new Map<string, PurchaseReport["bySupplier"][number]>();
  const days = new Map(
    daysIn(range).map((d) => [d, { amountPaise: 0, count: 0 }]),
  );
  let net = 0;
  let gst = 0;
  let paid = 0;
  let outstanding = 0;

  for (const p of active) {
    net += p.totals.netPaise;
    const day = days.get(p.invoiceDate);
    if (day) {
      day.amountPaise += p.totals.netPaise;
      day.count++;
    }
    gst += p.totals.gstPaise;
    paid += p.paidPaise;
    const due = getDuePaise(p);
    outstanding += due;
    const s = bySupplier.get(p.supplierId) ?? {
      supplierId: p.supplierId,
      name: p.supplierName,
      invoices: 0,
      amountPaise: 0,
      outstandingPaise: 0,
    };
    s.invoices++;
    s.amountPaise += p.totals.netPaise;
    s.outstandingPaise += due;
    bySupplier.set(p.supplierId, s);
  }

  return {
    invoiceCount: active.length,
    netPaise: net,
    gstPaise: gst,
    paidPaise: paid,
    outstandingPaise: outstanding,
    debitNotesPaise: debitNotes
      .filter((d) => inRange(d.date, range))
      .reduce((s, d) => s + d.totalPaise, 0),
    daily: [...days.entries()].map(([date, v]) => ({ date, ...v })),
    bySupplier: [...bySupplier.values()].sort(
      (a, b) => b.amountPaise - a.amountPaise,
    ),
  };
}

/* ------------------------------------------------------------------ */
/* GST (GSTR-3B style summary)                                        */
/* ------------------------------------------------------------------ */

export type GstRow = {
  rate: number;
  outTaxablePaise: Paise;
  outGstPaise: Paise;
  /** Part of outGstPaise charged as IGST (B2B buyer in another state) */
  outIgstPaise: Paise;
  inTaxablePaise: Paise;
  inGstPaise: Paise;
};

export type GstReport = {
  rows: GstRow[];
  outGstPaise: Paise;
  inGstPaise: Paise;
  /** Output GST − input tax credit. Negative = credit carried forward. */
  netPayablePaise: Paise;
};

/**
 * Output GST from sales (minus customer returns) and input GST from
 * purchases (minus debit notes), per slab. Retail prices include GST, so
 * output GST is taken out of the sale amount.
 */
export function gstReport(
  sales: readonly Sale[],
  saleReturns: readonly SaleReturn[],
  purchases: readonly Purchase[],
  debitNotes: readonly PurchaseReturn[],
  range: DateRange,
): GstReport {
  const rows = new Map<number, GstRow>(
    GST_RATES.map((rate) => [
      rate,
      {
        rate,
        outTaxablePaise: 0,
        outGstPaise: 0,
        outIgstPaise: 0,
        inTaxablePaise: 0,
        inGstPaise: 0,
      },
    ]),
  );
  const row = (rate: number) => {
    let r = rows.get(rate);
    if (!r) {
      r = {
        rate,
        outTaxablePaise: 0,
        outGstPaise: 0,
        outIgstPaise: 0,
        inTaxablePaise: 0,
        inGstPaise: 0,
      };
      rows.set(rate, r);
    }
    return r;
  };

  // Output: sales
  const saleLineRate = new Map<string, number>();
  const interstateLine = new Set<string>();
  for (const s of sales) {
    for (const l of s.lines) {
      saleLineRate.set(l.id, l.gstPercent);
      if (s.interstate) interstateLine.add(l.id);
    }
    if (!inRange(s.createdAt, range)) continue;
    for (const l of s.lines) {
      const r = row(l.gstPercent);
      r.outTaxablePaise += l.taxablePaise;
      r.outGstPaise += l.gstPaise;
      if (s.interstate) r.outIgstPaise += l.gstPaise;
    }
  }
  // Output reduced by customer returns
  for (const ret of saleReturns) {
    if (!inRange(ret.createdAt, range)) continue;
    for (const l of ret.lines) {
      const rate = saleLineRate.get(l.saleLineId) ?? 0;
      const { taxablePaise, gstPaise } = splitInclusive(l.amountPaise, rate);
      const r = row(rate);
      r.outTaxablePaise -= taxablePaise;
      r.outGstPaise -= gstPaise;
      if (interstateLine.has(l.saleLineId)) r.outIgstPaise -= gstPaise;
    }
  }
  // Input: purchases
  for (const p of purchases) {
    if (p.status === "cancelled" || !inRange(p.invoiceDate, range)) continue;
    for (const l of p.lines) {
      const a = calcLine(l);
      const r = row(l.gstPercent);
      r.inTaxablePaise += a.taxablePaise;
      r.inGstPaise += a.gstPaise;
    }
  }
  // Input reduced by debit notes (returns to suppliers)
  for (const d of debitNotes) {
    if (!inRange(d.date, range)) continue;
    for (const l of d.lines) {
      const r = row(l.gstPercent);
      r.inTaxablePaise -= l.amountPaise - l.gstPaise;
      r.inGstPaise -= l.gstPaise;
    }
  }

  const list = [...rows.values()].sort((a, b) => a.rate - b.rate);
  const out = list.reduce((s, r) => s + r.outGstPaise, 0);
  const inp = list.reduce((s, r) => s + r.inGstPaise, 0);
  return {
    rows: list,
    outGstPaise: out,
    inGstPaise: inp,
    netPayablePaise: out - inp,
  };
}

/* ------------------------------------------------------------------ */
/* Stock (as of now)                                                  */
/* ------------------------------------------------------------------ */

export type StockItemRow = {
  batchId: string;
  medicineName: string;
  batchNo: string;
  expiry: string;
  qtyText: string;
  costPaise: Paise;
};

export type StockReport = {
  batchCount: number;
  costValuePaise: Paise;
  mrpValuePaise: Paise;
  byCategory: {
    category: string;
    batches: number;
    costPaise: Paise;
    mrpPaise: Paise;
  }[];
  expiring: StockItemRow[];
  expiringValuePaise: Paise;
  expired: StockItemRow[];
  expiredValuePaise: Paise;
  lowStock: {
    medicineId: string;
    name: string;
    stockText: string;
    minStock: number;
  }[];
};

export function stockReport(
  batches: readonly StockBatch[],
  medicines: readonly Medicine[],
  expiringDays: number,
  now = new Date(),
): StockReport {
  const byId = new Map(medicines.map((m) => [m.id, m]));
  const cats = new Map<string, StockReport["byCategory"][number]>();
  const strips = new Map<string, { strip: number; loose: number }>();
  const expiring: StockItemRow[] = [];
  const expired: StockItemRow[] = [];
  let count = 0;
  let cost = 0;
  let mrp = 0;
  let expiringValue = 0;
  let expiredValue = 0;

  for (const b of batches) {
    const m = byId.get(b.medicineId);
    if (!m || (b.qtyStrip <= 0 && b.qtyLoose <= 0)) continue;
    const c = batchCostPaise(b, m);
    const v = batchMrpPaise(b, m);
    count++;
    cost += c;
    mrp += v;

    const label = CATEGORY_LABELS[m.category];
    const cat = cats.get(label) ?? {
      category: label,
      batches: 0,
      costPaise: 0,
      mrpPaise: 0,
    };
    cat.batches++;
    cat.costPaise += c;
    cat.mrpPaise += v;
    cats.set(label, cat);

    // Below-minimum uses SELLABLE stock only (expired batches don't count)
    if (!isExpiryPast(b.expiry, now)) {
      const s = strips.get(m.id) ?? { strip: 0, loose: 0 };
      s.strip += b.qtyStrip;
      s.loose += b.qtyLoose;
      strips.set(m.id, s);
    }

    const qtyText =
      m.unit === "LSE"
        ? `${b.qtyLoose} LSE`
        : `${b.qtyStrip} ${m.unit}${b.qtyLoose ? ` + ${b.qtyLoose} LSE` : ""}`;
    const rowData = {
      batchId: b.id,
      medicineName: m.name,
      batchNo: b.batchNo,
      expiry: b.expiry,
      qtyText,
      costPaise: c,
    };
    if (isExpiryPast(b.expiry, now)) {
      expired.push(rowData);
      expiredValue += c;
    } else if (isExpiringWithin(b.expiry, expiringDays, now)) {
      expiring.push(rowData);
      expiringValue += c;
    }
  }

  const lowStock = medicines
    .filter((m) => m.status === "active")
    .map((m) => ({ m, s: strips.get(m.id) ?? { strip: 0, loose: 0 } }))
    .filter(({ m, s }) => (m.unit === "LSE" ? s.loose : s.strip) < m.minStock)
    .map(({ m, s }) => ({
      medicineId: m.id,
      name: m.name,
      stockText: m.unit === "LSE" ? `${s.loose} LSE` : `${s.strip} ${m.unit}`,
      minStock: m.minStock,
    }));

  const byExpiry = (a: StockItemRow, b: StockItemRow) =>
    compareExpiry(a.expiry, b.expiry);
  return {
    batchCount: count,
    costValuePaise: cost,
    mrpValuePaise: mrp,
    byCategory: [...cats.values()].sort((a, b) => b.costPaise - a.costPaise),
    expiring: expiring.sort(byExpiry),
    expiringValuePaise: expiringValue,
    expired: expired.sort(byExpiry),
    expiredValuePaise: expiredValue,
    lowStock,
  };
}

/* ------------------------------------------------------------------ */
/* Sales insights — "why does the chart go up and down?"               */
/* ------------------------------------------------------------------ */

export const WEEKDAYS = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;

export type SalesInsights = {
  days: number;
  avgPerDayPaise: Paise;
  best: { date: string; amountPaise: Paise } | null;
  worst: { date: string; amountPaise: Paise } | null;
  /** Average sales for each weekday (Sun … Sat); null when that weekday isn't in range */
  weekday: (Paise | null)[];
  busiestWeekday: number | null;
  quietestWeekday: number | null;
  /** % more (or less) on the 1st–5th of the month vs other days; null if not measurable */
  salaryLiftPct: number | null;
  /** % change of the second half of the period vs the first half; null if too short */
  trendPct: number | null;
};

const avg = (xs: number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;

export function salesInsights(daily: SalesReport["daily"]): SalesInsights {
  const days = daily.length;
  const amounts = daily.map((d) => d.amountPaise);
  const withSales = daily.filter((d) => d.amountPaise > 0);

  const byWeekday: number[][] = WEEKDAYS.map(() => []);
  const salary: number[] = [];
  const other: number[] = [];
  for (const d of daily) {
    const date = new Date(`${d.date}T00:00:00`);
    byWeekday[date.getDay()].push(d.amountPaise);
    (date.getDate() <= 5 ? salary : other).push(d.amountPaise);
  }
  const weekday = byWeekday.map((xs) =>
    xs.length ? Math.round(avg(xs)) : null,
  );
  const ranked = weekday
    .map((v, i) => ({ v, i }))
    .filter((x): x is { v: number; i: number } => x.v !== null);
  // Weekday pattern only means something once every weekday appears
  const enoughForWeekdays = ranked.length === 7;

  const salaryAvg = avg(salary);
  const otherAvg = avg(other);
  const half = Math.floor(days / 2);
  const firstAvg = avg(amounts.slice(0, half));
  const secondAvg = avg(amounts.slice(days - half));

  const sorted = [...withSales].sort((a, b) => b.amountPaise - a.amountPaise);

  return {
    days,
    avgPerDayPaise: Math.round(avg(amounts)),
    best: sorted[0]
      ? { date: sorted[0].date, amountPaise: sorted[0].amountPaise }
      : null,
    worst:
      sorted.length > 1
        ? { date: sorted.at(-1)!.date, amountPaise: sorted.at(-1)!.amountPaise }
        : null,
    weekday,
    busiestWeekday: enoughForWeekdays
      ? ranked.reduce((a, b) => (b.v > a.v ? b : a)).i
      : null,
    quietestWeekday: enoughForWeekdays
      ? ranked.reduce((a, b) => (b.v < a.v ? b : a)).i
      : null,
    salaryLiftPct:
      salary.length >= 2 && other.length >= 5 && otherAvg > 0
        ? Math.round(((salaryAvg - otherAvg) / otherAvg) * 100)
        : null,
    trendPct:
      days >= 14 && firstAvg > 0
        ? Math.round(((secondAvg - firstAvg) / firstAvg) * 100)
        : null,
  };
}
