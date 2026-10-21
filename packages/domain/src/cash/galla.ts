/**
 * Galla (the cash drawer) — one "day" per drawer:
 *
 *   opening cash (counted in the morning)
 *   + cash bills (a split bill's cash part too)
 *   + udhaar paid back in cash, other cash put in
 *   − cash refunds (sales returns), suppliers paid in cash, expenses
 *   = cash that SHOULD be in the drawer
 *
 * At night the cashier counts the notes; the difference (short / excess)
 * is saved with the day, and what is left in the drawer for tomorrow
 * becomes tomorrow's opening. Single computer: one galla for the shop.
 * Multi-counter: one per counter.
 *
 * Pure: the server feeds it the day's bills and entries.
 */
import type { Sale } from "../billing/types";
import type { Paise } from "../lib/money";

export type CashKind = "in" | "out";

/**
 * Where an entry came from. Only "manual" entries are typed on the galla
 * screen (and can be removed); the others are written by the app when the
 * money moves (a cash refund, udhaar paid in cash, a supplier paid from
 * the drawer) and are the audit trail.
 */
export type CashSource = "manual" | "refund" | "udhaar" | "supplier";

export const CASH_IN_CATEGORIES = ["Change added", "Other income"] as const;
export const CASH_OUT_CATEGORIES = [
  "Shop expense",
  "Supplier payment",
  "Salary / advance",
  "Owner took cash",
  "Bank deposit",
  "Other",
] as const;

export type CashEntry = {
  id: string;
  /** Business day, "YYYY-MM-DD" (shop's local date) */
  date: string;
  /** "" = the shop's only galla (single computer) */
  counter: string;
  /** ISO timestamp */
  at: string;
  kind: CashKind;
  category: string;
  amountPaise: Paise;
  note: string;
  /** Who entered it */
  by: string;
  source: CashSource;
  /** Bill / return / purchase / receipt it belongs to */
  ref: string;
};

export type CashDayStatus = "open" | "closed";

export type CashDay = {
  id: string;
  date: string;
  counter: string;
  status: CashDayStatus;
  openingPaise: Paise;
  openedAt: string;
  openedBy: string;
  /** Counted at closing (null while open) */
  countedPaise: Paise | null;
  /** What the app expected at closing — kept, so later edits can't change it */
  expectedPaise: Paise | null;
  /** Left in the drawer for tomorrow (the rest went to the owner / bank) */
  keptPaise: Paise | null;
  /** Notes counted, e.g. { "500": 12, "100": 7, "coins": 4300 } */
  denominations: Record<string, number>;
  closedAt: string | null;
  closedBy: string;
  note: string;
};

export type GallaSummary = {
  openingPaise: Paise;
  /** Bills paid (fully or partly) in cash */
  cashBills: number;
  cashSalesPaise: Paise;
  udhaarCollectedPaise: Paise;
  otherInPaise: Paise;
  refundsPaise: Paise;
  supplierPaidPaise: Paise;
  /** Every other cash taken out (expenses, salary, owner, bank) */
  otherOutPaise: Paise;
  inPaise: Paise;
  outPaise: Paise;
  expectedPaise: Paise;
  /** The rest of the day's sales — not in the drawer, for the day report */
  bills: number;
  salesPaise: Paise;
  upiPaise: Paise;
  cardPaise: Paise;
  walletPaise: Paise;
  udhaarGivenPaise: Paise;
};

/** Cash that went into the drawer for one bill */
export function cashOfSale(s: Sale): Paise {
  if (s.payment.method === "cash") return s.totals.netPaise;
  if (s.payment.method === "split") return s.payment.split?.cashPaise ?? 0;
  return 0;
}

export function summarizeGalla(input: {
  openingPaise: Paise;
  /** The day's bills at this galla */
  sales: readonly Sale[];
  /** The day's cash entries at this galla */
  entries: readonly CashEntry[];
}): GallaSummary {
  const s: GallaSummary = {
    openingPaise: input.openingPaise,
    cashBills: 0,
    cashSalesPaise: 0,
    udhaarCollectedPaise: 0,
    otherInPaise: 0,
    refundsPaise: 0,
    supplierPaidPaise: 0,
    otherOutPaise: 0,
    inPaise: 0,
    outPaise: 0,
    expectedPaise: 0,
    bills: 0,
    salesPaise: 0,
    upiPaise: 0,
    cardPaise: 0,
    walletPaise: 0,
    udhaarGivenPaise: 0,
  };
  for (const b of input.sales) {
    const net = b.totals.netPaise;
    s.bills += 1;
    s.salesPaise += net;
    const cash = cashOfSale(b);
    if (cash > 0) {
      s.cashBills += 1;
      s.cashSalesPaise += cash;
    }
    const p = b.payment;
    if (p.method === "upi") s.upiPaise += net;
    else if (p.method === "card") s.cardPaise += net;
    else if (p.method === "wallet") s.walletPaise += net;
    else if (p.method === "udhaar") s.udhaarGivenPaise += net;
    else if (p.method === "split" && p.split) {
      s.upiPaise += p.split.upiPaise;
      s.cardPaise += p.split.cardPaise;
    }
  }
  for (const e of input.entries) {
    if (e.kind === "in") {
      if (e.source === "udhaar") s.udhaarCollectedPaise += e.amountPaise;
      else s.otherInPaise += e.amountPaise;
    } else if (e.source === "refund") s.refundsPaise += e.amountPaise;
    else if (e.source === "supplier" || e.category === "Supplier payment")
      s.supplierPaidPaise += e.amountPaise;
    else s.otherOutPaise += e.amountPaise;
  }
  s.inPaise = s.cashSalesPaise + s.udhaarCollectedPaise + s.otherInPaise;
  s.outPaise = s.refundsPaise + s.supplierPaidPaise + s.otherOutPaise;
  s.expectedPaise = s.openingPaise + s.inPaise - s.outPaise;
  return s;
}

/* ------------------------------------------------------------------ */
/* Counting the notes                                                 */
/* ------------------------------------------------------------------ */

/** Notes in use today (₹), largest first; coins are typed as one amount */
export const NOTES = [500, 200, 100, 50, 20, 10] as const;
export const COINS_KEY = "coins";

/**
 * { "500": 3, "100": 2, coins: 4500 } → total paise.
 * Note counts are pieces; "coins" is already in paise.
 */
export function countedTotal(d: Record<string, number>): Paise {
  let t = 0;
  for (const n of NOTES)
    t += Math.max(0, Math.floor(d[String(n)] ?? 0)) * n * 100;
  return t + Math.max(0, Math.round(d[COINS_KEY] ?? 0));
}

/** Only known keys, whole non-negative numbers, sane sizes */
export function cleanDenominations(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== "object") return out;
  const r = raw as Record<string, unknown>;
  for (const n of NOTES) {
    const v = Number(r[String(n)]);
    if (Number.isFinite(v) && v > 0)
      out[String(n)] = Math.min(Math.floor(v), 100_000);
  }
  const c = Number(r[COINS_KEY]);
  if (Number.isFinite(c) && c > 0)
    out[COINS_KEY] = Math.min(Math.round(c), 10_000_000);
  return out;
}

/** counted − expected: below zero = short, above = excess */
export const differenceOf = (
  d: Pick<CashDay, "countedPaise" | "expectedPaise">,
) =>
  d.countedPaise === null || d.expectedPaise === null
    ? null
    : d.countedPaise - d.expectedPaise;

/** A difference of a rupee or less is rounding, not a problem */
export const DIFF_TOLERANCE_PAISE = 100;

/** "2026-10-21" → the local day's [start, end) as ISO timestamps */
export function dayRange(date: string): [string, string] {
  const [y, m, d] = date.split("-").map(Number);
  const from = new Date(y, m - 1, d);
  const to = new Date(y, m - 1, d + 1);
  return [from.toISOString(), to.toISOString()];
}

/** Local business date of a timestamp (or now) */
export function businessDate(at: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${at.getFullYear()}-${p(at.getMonth() + 1)}-${p(at.getDate())}`;
}

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
