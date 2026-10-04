/**
 * Retail pricing. In India MRP / sale price already INCLUDE GST, so the
 * customer pays the price shown — GST is only split out for the bill.
 */
import { percentOf, roundToRupee } from "@/lib/money";
import { splitCgstSgst, splitInclusive } from "@/lib/gst";
import type { BatchAllocation, LineAmounts, SaleTotals } from "../types";

/** Gross for a set of allocations: packs × rate + loose × (rate ÷ units per pack) */
export function grossOf(
  allocations: readonly BatchAllocation[],
  ups: number,
): number {
  let exact = 0;
  for (const a of allocations) {
    exact += a.qtyStrip * a.ratePaise + (a.qtyLoose * a.ratePaise) / ups;
  }
  return Math.round(exact);
}

export function priceLine(
  allocations: readonly BatchAllocation[],
  ups: number,
  discountPercent: number,
  gstPercent: number,
): LineAmounts {
  const grossPaise = grossOf(allocations, ups);
  const discountPaise = percentOf(grossPaise, discountPercent);
  const amountPaise = grossPaise - discountPaise;
  const { taxablePaise, gstPaise } = splitInclusive(amountPaise, gstPercent);
  return { grossPaise, discountPaise, amountPaise, taxablePaise, gstPaise };
}

export const EMPTY_SALE_TOTALS: SaleTotals = {
  itemCount: 0,
  grossPaise: 0,
  discountPaise: 0,
  taxablePaise: 0,
  cgstPaise: 0,
  sgstPaise: 0,
  gstPaise: 0,
  roundOffPaise: 0,
  netPaise: 0,
};

export function calcSaleTotals(lines: readonly LineAmounts[]): SaleTotals {
  if (lines.length === 0) return EMPTY_SALE_TOTALS;
  let gross = 0;
  let discount = 0;
  let amount = 0;
  let taxable = 0;
  let gst = 0;
  for (const l of lines) {
    gross += l.grossPaise;
    discount += l.discountPaise;
    amount += l.amountPaise;
    taxable += l.taxablePaise;
    gst += l.gstPaise;
  }
  const { rounded, roundOff } = roundToRupee(amount);
  const { cgstPaise, sgstPaise } = splitCgstSgst(gst);
  return {
    itemCount: lines.length,
    grossPaise: gross,
    discountPaise: discount,
    taxablePaise: taxable,
    cgstPaise,
    sgstPaise,
    gstPaise: gst,
    roundOffPaise: roundOff,
    netPaise: rounded,
  };
}
