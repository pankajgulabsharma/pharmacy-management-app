/**
 * Customer udhaar ledger (khata) — pure functions, no React.
 *   + udhaar bill          (customer owes more)
 *   − sales return adjusted in udhaar
 *   − payment received
 */
import type { Sale, SaleReturn } from "../billing/types";
import type { Paise } from "../lib/money";
import type { Customer, CustomerPayment } from "./types";

export type LedgerEntry = {
  id: string;
  at: string;
  kind: "bill" | "return" | "payment";
  /** Bill no. / return no. / receipt no. */
  ref: string;
  note: string;
  debitPaise: Paise;
  creditPaise: Paise;
  /** Balance after this entry (positive = customer owes us) */
  balancePaise: Paise;
};

export type CustomerSummary = {
  balancePaise: Paise;
  udhaarBills: number;
  billedPaise: Paise;
  receivedPaise: Paise;
  adjustedPaise: Paise;
  lastActivity: string | null;
};

const EMPTY: CustomerSummary = {
  balancePaise: 0,
  udhaarBills: 0,
  billedPaise: 0,
  receivedPaise: 0,
  adjustedPaise: 0,
  lastActivity: null,
};

/** Full statement for one customer, oldest first, with running balance */
export function customerLedger(
  customerId: string,
  sales: readonly Sale[],
  saleReturns: readonly SaleReturn[],
  payments: readonly CustomerPayment[],
): LedgerEntry[] {
  const udhaarSaleIds = new Map<string, Sale>();
  const raw: Omit<LedgerEntry, "balancePaise">[] = [];
  for (const s of sales) {
    if (s.customerId !== customerId || s.status !== "udhaar") continue;
    udhaarSaleIds.set(s.id, s);
    raw.push({
      id: s.id,
      at: s.createdAt,
      kind: "bill",
      ref: s.billNo,
      note: `${s.lines.length} item(s)`,
      debitPaise: s.totals.netPaise,
      creditPaise: 0,
    });
  }
  for (const r of saleReturns) {
    if (r.refundMode !== "udhaar_adjust" || !udhaarSaleIds.has(r.saleId))
      continue;
    raw.push({
      id: r.id,
      at: r.createdAt,
      kind: "return",
      ref: r.returnNo,
      note: `Return on ${r.billNo}`,
      debitPaise: 0,
      creditPaise: r.refundPaise,
    });
  }
  for (const p of payments) {
    if (p.customerId !== customerId) continue;
    raw.push({
      id: p.id,
      at: p.at,
      kind: "payment",
      ref: p.receiptNo,
      note: p.note || p.method.toUpperCase(),
      debitPaise: 0,
      creditPaise: p.amountPaise,
    });
  }
  raw.sort((a, b) => a.at.localeCompare(b.at) || (a.kind === "bill" ? -1 : 1));
  let balance = 0;
  return raw.map((e) => {
    balance += e.debitPaise - e.creditPaise;
    return { ...e, balancePaise: balance };
  });
}

/** Summary for every customer in one pass (list screen, billing, dashboard) */
export function customerSummaries(
  customers: readonly Customer[],
  sales: readonly Sale[],
  saleReturns: readonly SaleReturn[],
  payments: readonly CustomerPayment[],
): Map<string, CustomerSummary> {
  const map = new Map<string, CustomerSummary>(
    customers.map((c) => [c.id, { ...EMPTY }]),
  );
  const touch = (s: CustomerSummary, at: string) => {
    if (!s.lastActivity || at > s.lastActivity) s.lastActivity = at;
  };
  const saleOwner = new Map<string, string>();
  for (const sale of sales) {
    if (sale.status !== "udhaar" || !sale.customerId) continue;
    const s = map.get(sale.customerId);
    if (!s) continue;
    saleOwner.set(sale.id, sale.customerId);
    s.udhaarBills++;
    s.billedPaise += sale.totals.netPaise;
    s.balancePaise += sale.totals.netPaise;
    touch(s, sale.createdAt);
  }
  for (const r of saleReturns) {
    const owner =
      r.refundMode === "udhaar_adjust" ? saleOwner.get(r.saleId) : undefined;
    const s = owner ? map.get(owner) : undefined;
    if (!s) continue;
    s.adjustedPaise += r.refundPaise;
    s.balancePaise -= r.refundPaise;
    touch(s, r.createdAt);
  }
  for (const p of payments) {
    const s = map.get(p.customerId);
    if (!s) continue;
    s.receivedPaise += p.amountPaise;
    s.balancePaise -= p.amountPaise;
    touch(s, p.at);
  }
  return map;
}

/** "RC-0001", … */
export function nextReceiptNo(
  payments: readonly Pick<CustomerPayment, "receiptNo">[],
): string {
  let max = 0;
  for (const p of payments) {
    const n = Number(/^RC-(\d+)$/.exec(p.receiptNo)?.[1] ?? 0);
    if (n > max) max = n;
  }
  return `RC-${String(max + 1).padStart(4, "0")}`;
}

export const totalUdhaar = (summaries: ReadonlyMap<string, CustomerSummary>) =>
  [...summaries.values()].reduce((a, s) => a + Math.max(0, s.balancePaise), 0);
