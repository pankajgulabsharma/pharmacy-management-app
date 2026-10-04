/**
 * Money helpers.
 *
 * All amounts are handled as integer **paise** (₹1 = 100 paise) so that
 * totals never suffer from floating-point errors (0.1 + 0.2 !== 0.3).
 * Convert to rupees only for display.
 */
export type Paise = number;

/** Up to 8 rupee digits and 2 decimals, e.g. "42", "42.5", "42.50" */
const MONEY_RE = /^\d{1,8}(\.\d{0,2})?$/;

/** While typing: allows "", "4", "42.", "42.5" — blocks letters & 3+ decimals */
const MONEY_TYPING_RE = /^\d{0,8}(\.\d{0,2})?$/;

export function isMoneyInput(value: string): boolean {
  return MONEY_TYPING_RE.test(value);
}

export function rupeesToPaise(rupees: number): Paise {
  return Math.round(rupees * 100);
}

/** Parses user text into paise. Returns null when the text is not a valid amount. */
export function parseRupees(input: string): Paise | null {
  const s = input.trim();
  if (!MONEY_RE.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

/** Paise → editable input text ("42" / "42.5") */
export function paiseToInput(p: Paise): string {
  return (p / 100).toFixed(2).replace(/\.?0+$/, "");
}

/** One shared formatter — much cheaper than toLocaleString() per call */
const inr = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 123456 → "1,234.56" */
export function formatPaise(p: Paise): string {
  return inr.format(p / 100);
}

/**
 * For features that still keep rupees as numbers (billing):
 * 1234.5 → "1,234.50". Prefer paise + formatPaise for new code.
 */
export function formatRupees(rupees: number): string {
  return inr.format(rupees);
}

/** 123456 → "₹1,234.56", -9407 → "− ₹94.07" */
export function inrFromPaise(p: Paise): string {
  return `${p < 0 ? "− " : ""}₹${formatPaise(Math.abs(p))}`;
}

const inrWhole = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** Whole rupees for summaries and sentences: 326475 → "₹3,265" */
export function inrRounded(p: Paise): string {
  return `₹${inrWhole.format(Math.round(p / 100))}`;
}

/** Signed amount for round-off style rows: "+ ₹0.34", "− ₹0.20", "₹0.00" */
export function signedInrFromPaise(p: Paise): string {
  if (p === 0) return "₹0.00";
  return `${p > 0 ? "+" : "−"} ₹${formatPaise(Math.abs(p))}`;
}

/** Percentage of an amount, rounded to the nearest paisa */
export function percentOf(p: Paise, percent: number): Paise {
  return Math.round((p * percent) / 100);
}

/** Round to the nearest rupee (Indian invoice style) */
export function roundToRupee(p: Paise): { rounded: Paise; roundOff: Paise } {
  const rounded = Math.round(p / 100) * 100;
  return { rounded, roundOff: rounded - p };
}
