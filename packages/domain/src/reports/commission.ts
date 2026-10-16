/**
 * Doctor referrals & staff commission — worked out from the bills the shop
 * already has (the doctor's name on the bill, who billed it). Nothing extra
 * is typed at the counter.
 *
 *  • basis "sales":  % of what the customer paid (after returns)
 *  • basis "profit": % of the profit on those bills (sales − cost of the
 *    batches sold), after returns
 *
 * A rate of 0 still lists the person — "doctor-wise sales" is useful on
 * its own. Paid = payouts the owner recorded for this period.
 */
import type { Sale } from "../billing/types";
import type { StockBatch } from "../inventory/types";
import { toISODate } from "../lib/date";
import type { Paise } from "../lib/money";
import { inRange, type DateRange } from "./period";
import { lineCostPaise } from "./stockInsights";

export type CommissionBasis = "sales" | "profit";
export type CommissionKind = "doctor" | "staff";

export type CommissionRates = {
  basis: CommissionBasis;
  /** Name (as on the bill) → percent */
  doctors: Record<string, number>;
  staff: Record<string, number>;
};

export const DEFAULT_RATES: CommissionRates = {
  basis: "sales",
  doctors: {},
  staff: {},
};

export type CommissionPayout = {
  id: string;
  kind: CommissionKind;
  name: string;
  /** Period paid for (YYYY-MM-DD, inclusive) */
  from: string;
  to: string;
  amountPaise: Paise;
  paidAt: string;
  note: string;
};

export type CommissionRow = {
  kind: CommissionKind;
  name: string;
  bills: number;
  salesPaise: Paise;
  profitPaise: Paise;
  ratePct: number;
  commissionPaise: Paise;
  paidPaise: Paise;
  duePaise: Paise;
};

export const MAX_RATE = 50;

/** Same name however it was typed ("dr. kavita shah " = "Dr. Kavita Shah") */
export const personKey = (name: string) =>
  name.trim().replace(/\s+/g, " ").toLowerCase();

const rateFor = (rates: Record<string, number>, name: string) => {
  const k = personKey(name);
  for (const [n, pct] of Object.entries(rates))
    if (personKey(n) === k) return pct;
  return 0;
};

/** Keeps only sensible rates (0–50 %, two decimals), names trimmed */
export function cleanRates(raw: unknown): CommissionRates {
  const r = (raw ?? {}) as Partial<CommissionRates>;
  const list = (v: unknown) => {
    const out: Record<string, number> = {};
    if (!v || typeof v !== "object") return out;
    for (const [name, pct] of Object.entries(v as Record<string, unknown>)) {
      const n = name.trim().replace(/\s+/g, " ").slice(0, 80);
      const p = Number(pct);
      if (!n || !Number.isFinite(p) || p <= 0) continue;
      out[n] = Math.round(Math.min(p, MAX_RATE) * 100) / 100;
    }
    return out;
  };
  return {
    basis: r.basis === "profit" ? "profit" : "sales",
    doctors: list(r.doctors),
    staff: list(r.staff),
  };
}

export function commissionReport(
  sales: readonly Sale[],
  batches: readonly StockBatch[],
  rates: CommissionRates,
  range: DateRange,
  payouts: readonly CommissionPayout[] = [],
  /** "YYYY-MM-DD" of the range, to match payouts recorded for it */
  period?: { from: string; to: string },
): { doctors: CommissionRow[]; staff: CommissionRow[]; totalDuePaise: Paise } {
  const costOf = new Map(batches.map((b) => [b.id, b.purchasePrice]));
  const rows = {
    doctor: new Map<string, CommissionRow>(),
    staff: new Map<string, CommissionRow>(),
  };
  const add = (
    kind: CommissionKind,
    name: string,
    salesPaise: number,
    profitPaise: number,
  ) => {
    const clean = name.trim().replace(/\s+/g, " ");
    if (!clean) return;
    const map = rows[kind];
    const k = personKey(clean);
    const r = map.get(k) ?? {
      kind,
      name: clean,
      bills: 0,
      salesPaise: 0,
      profitPaise: 0,
      ratePct: rateFor(kind === "doctor" ? rates.doctors : rates.staff, clean),
      commissionPaise: 0,
      paidPaise: 0,
      duePaise: 0,
    };
    r.bills++;
    r.salesPaise += salesPaise;
    r.profitPaise += profitPaise;
    map.set(k, r);
  };

  for (const s of sales) {
    if (!inRange(s.createdAt, range)) continue;
    const net = s.totals.netPaise;
    if (net <= 0) continue;
    const kept = Math.max(0, net - (s.returnedPaise ?? 0));
    const share = kept / net;
    let profit = 0;
    for (const l of s.lines) profit += l.amountPaise - lineCostPaise(l, costOf);
    const p = Math.round(profit * share);
    add("doctor", s.doctor, kept, p);
    add("staff", s.billedBy ?? "", kept, p);
  }

  const inPeriod = (x: CommissionPayout) =>
    !period || (x.from >= period.from && x.to <= period.to);
  let totalDue = 0;
  const finish = (map: Map<string, CommissionRow>) =>
    [...map.values()]
      .map((r) => {
        const base = rates.basis === "profit" ? r.profitPaise : r.salesPaise;
        const commissionPaise = Math.max(
          0,
          Math.round((base * r.ratePct) / 100),
        );
        const paidPaise = payouts
          .filter(
            (x) =>
              x.kind === r.kind &&
              personKey(x.name) === personKey(r.name) &&
              inPeriod(x),
          )
          .reduce((a, x) => a + x.amountPaise, 0);
        const duePaise = Math.max(0, commissionPaise - paidPaise);
        totalDue += duePaise;
        return { ...r, commissionPaise, paidPaise, duePaise };
      })
      .sort(
        (a, b) =>
          b.commissionPaise - a.commissionPaise || b.salesPaise - a.salesPaise,
      );
  const doctors = finish(rows.doctor);
  const staff = finish(rows.staff);
  return { doctors, staff, totalDuePaise: totalDue };
}

/** Bills of the range as dates, for recording a payout */
export const periodOf = (range: DateRange) => ({
  from: toISODate(range.from),
  to: toISODate(range.to),
});
