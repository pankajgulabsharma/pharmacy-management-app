import { percentOf, roundToRupee, type Paise } from "../lib/money";
import { diffInDays, parseISODate } from "../lib/date";
import type { PaymentStatus, Purchase, PurchaseTotals } from "./types";

/** Numbers needed to price one line */
export type LineAmountInput = {
  qty: number;
  freeQty: number;
  ratePaise: Paise;
  discountPercent: number;
  gstPercent: number;
};

export type LineAmounts = {
  grossPaise: Paise;
  discountPaise: Paise;
  taxablePaise: Paise;
  gstPaise: Paise;
  totalPaise: Paise;
  /** Cost per billed pack incl. GST (used for the MRP check) */
  costPerPackPaise: Paise;
  /** Effective cost per pack incl. GST, spread over billed + free packs */
  landedPerPackPaise: Paise;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/**
 * Indian purchase invoice line:
 * gross = qty × rate → − trade discount → taxable → + GST → line total.
 * Free (scheme) packs cost nothing but lower the landed cost per pack.
 */
export function calcLine(l: LineAmountInput): LineAmounts {
  const qty = Math.max(0, Math.trunc(l.qty));
  const freeQty = Math.max(0, Math.trunc(l.freeQty));

  const grossPaise = qty * Math.max(0, l.ratePaise);
  const discountPaise = percentOf(grossPaise, clamp(l.discountPercent, 0, 100));
  const taxablePaise = grossPaise - discountPaise;
  const gstPaise = percentOf(taxablePaise, Math.max(0, l.gstPercent));
  const totalPaise = taxablePaise + gstPaise;

  return {
    grossPaise,
    discountPaise,
    taxablePaise,
    gstPaise,
    totalPaise,
    costPerPackPaise: qty > 0 ? Math.round(totalPaise / qty) : 0,
    landedPerPackPaise:
      qty + freeQty > 0 ? Math.round(totalPaise / (qty + freeQty)) : 0,
  };
}

export const EMPTY_TOTALS: PurchaseTotals = {
  lineCount: 0,
  totalQty: 0,
  totalFreeQty: 0,
  grossPaise: 0,
  discountPaise: 0,
  taxablePaise: 0,
  cgstPaise: 0,
  sgstPaise: 0,
  gstPaise: 0,
  roundOffPaise: 0,
  netPaise: 0,
};

/**
 * Invoice totals. GST is split equally into CGST + SGST (intra-state
 * purchase). For inter-state suppliers this becomes IGST — add a flag on
 * Supplier when needed.
 */
export function calcTotals(lines: readonly LineAmountInput[]): PurchaseTotals {
  if (lines.length === 0) return EMPTY_TOTALS;

  let totalQty = 0;
  let totalFreeQty = 0;
  let grossPaise = 0;
  let discountPaise = 0;
  let taxablePaise = 0;
  let gstPaise = 0;

  for (const l of lines) {
    const a = calcLine(l);
    totalQty += Math.max(0, Math.trunc(l.qty));
    totalFreeQty += Math.max(0, Math.trunc(l.freeQty));
    grossPaise += a.grossPaise;
    discountPaise += a.discountPaise;
    taxablePaise += a.taxablePaise;
    gstPaise += a.gstPaise;
  }

  const cgstPaise = Math.floor(gstPaise / 2);
  const sgstPaise = gstPaise - cgstPaise;
  const { rounded, roundOff } = roundToRupee(taxablePaise + gstPaise);

  return {
    lineCount: lines.length,
    totalQty,
    totalFreeQty,
    grossPaise,
    discountPaise,
    taxablePaise,
    cgstPaise,
    sgstPaise,
    gstPaise,
    roundOffPaise: roundOff,
    netPaise: rounded,
  };
}

/** What we still owe on this invoice (0 for cancelled invoices) */
export function getDuePaise(p: Purchase): Paise {
  if (p.status === "cancelled") return 0;
  return Math.max(0, p.totals.netPaise - p.paidPaise - p.returnedPaise);
}

/**
 * Paid + returned beyond the invoice total — the supplier owes us this
 * (adjusted against future bills or refunded).
 */
export function getCreditPaise(p: Purchase): Paise {
  if (p.status === "cancelled") return p.paidPaise;
  return Math.max(0, p.paidPaise + p.returnedPaise - p.totals.netPaise);
}

export function getPaymentStatus(p: Purchase, today: Date): PaymentStatus {
  if (p.status === "cancelled") return "cancelled";
  const due = getDuePaise(p);
  if (due === 0) return "paid";
  const dueDate = parseISODate(p.dueDate);
  if (dueDate && diffInDays(today, dueDate) > 0) return "overdue";
  // "Partial" means money was paid; a return alone only lowers the balance
  return p.paidPaise > 0 ? "partial" : "due";
}

/** Money owed to suppliers across invoices — Dashboard, Suppliers, alerts */
export function duesSummary(purchases: readonly Purchase[], today: Date) {
  let duePaise = 0;
  let overduePaise = 0;
  let overdueCount = 0;
  for (const p of purchases) {
    const due = getDuePaise(p); // 0 for cancelled
    if (due === 0) continue;
    duePaise += due;
    if (getPaymentStatus(p, today) === "overdue") {
      overduePaise += due;
      overdueCount++;
    }
  }
  return { duePaise, overduePaise, overdueCount };
}
