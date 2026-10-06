import type { Paise } from "./money";

/**
 * GST slabs used for medicines. Most medicines moved to 5% in the
 * Sept 2025 GST revision — verify each HSN with your CA.
 */
export const GST_RATES = [0, 5, 12, 18] as const;
export type GstRate = (typeof GST_RATES)[number];
export const DEFAULT_GST_RATE: GstRate = 5;

export function isGstRate(n: number): n is GstRate {
  return (GST_RATES as readonly number[]).includes(n);
}

/**
 * Splits a GST-INCLUSIVE amount (like MRP / retail sale price) into
 * taxable value + GST. Retail prices in India already include GST, so
 * GST is taken OUT of the price — never added on top.
 *   ₹105.00 at 5% → taxable ₹100.00 + GST ₹5.00
 */
export function splitInclusive(
  amountPaise: Paise,
  rate: number,
): { taxablePaise: Paise; gstPaise: Paise } {
  const taxablePaise = Math.round((amountPaise * 100) / (100 + rate));
  return { taxablePaise, gstPaise: amountPaise - taxablePaise };
}

/** Intra-state supply: GST is split equally into CGST + SGST */
export function splitCgstSgst(gstPaise: Paise): {
  cgstPaise: Paise;
  sgstPaise: Paise;
} {
  const cgstPaise = Math.floor(gstPaise / 2);
  return { cgstPaise, sgstPaise: gstPaise - cgstPaise };
}
