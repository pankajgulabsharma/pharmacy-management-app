/**
 * Composition scheme (GST) — what a composition chemist files:
 *
 *   CMP-08 every quarter: 1% of turnover (0.5% CGST + 0.5% SGST), due the
 *          18th of the month after the quarter
 *   GSTR-4 once a year (by 30 April)
 *
 * Turnover = Bills of Supply made in the period, less what was refunded
 * on their returns. No input tax credit: GST paid on purchases is cost.
 * Tax invoices made before switching to composition are counted apart.
 */
import type { Sale, SaleReturn } from "../billing/types";
import type { Paise } from "../lib/money";
import { inRange, type DateRange } from "./period";

/** Traders (chemists): 1% of turnover */
export const COMPOSITION_RATE_PCT = 1;

export type CompositionSummary = {
  bills: number;
  salesPaise: Paise;
  returnsPaise: Paise;
  turnoverPaise: Paise;
  taxPaise: Paise;
  cgstPaise: Paise;
  sgstPaise: Paise;
  /** Tax invoices in the period (made before switching) */
  taxInvoices: number;
};

export function compositionSummary(
  sales: readonly Sale[],
  returns: readonly SaleReturn[],
  range: DateRange,
): CompositionSummary {
  const bos = new Set<string>();
  let bills = 0;
  let salesPaise = 0;
  let taxInvoices = 0;
  for (const s of sales) {
    if (s.billOfSupply) bos.add(s.id);
    if (!inRange(s.createdAt, range)) continue;
    if (s.billOfSupply) {
      bills++;
      salesPaise += s.totals.netPaise;
    } else taxInvoices++;
  }
  let returnsPaise = 0;
  for (const r of returns)
    if (bos.has(r.saleId) && inRange(r.createdAt, range))
      returnsPaise += r.refundPaise;
  const turnoverPaise = Math.max(0, salesPaise - returnsPaise);
  const taxPaise = Math.round((turnoverPaise * COMPOSITION_RATE_PCT) / 100);
  const cgstPaise = Math.floor(taxPaise / 2);
  return {
    bills,
    salesPaise,
    returnsPaise,
    turnoverPaise,
    taxPaise,
    cgstPaise,
    sgstPaise: taxPaise - cgstPaise,
    taxInvoices,
  };
}

export type CompositionQuarter = {
  /** "Apr–Jun 2026" */
  label: string;
  range: DateRange;
  /** CMP-08 due date */
  due: Date;
  summary: CompositionSummary;
};

const MON = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");

/** The four CMP-08 quarters of the financial year `date` falls in */
export function compositionQuarters(
  sales: readonly Sale[],
  returns: readonly SaleReturn[],
  date = new Date(),
): CompositionQuarter[] {
  const startYear =
    date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
  return [0, 1, 2, 3].map((q) => {
    const from = new Date(startYear, 3 + q * 3, 1);
    const to = new Date(startYear, 3 + q * 3 + 3, 0, 23, 59, 59, 999);
    return {
      label: `${MON[from.getMonth()]}–${MON[to.getMonth()]} ${to.getFullYear()}`,
      range: { from, to },
      due: new Date(to.getFullYear(), to.getMonth() + 1, 18),
      summary: compositionSummary(sales, returns, { from, to }),
    };
  });
}
