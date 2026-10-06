/**
 * Input hygiene helpers.
 *
 * React already escapes rendered text (no XSS through JSX), but we still
 * normalise what we store: strip control characters, collapse whitespace
 * and cap length so bad input can't break layouts, CSV exports or a future API.
 */

/** Removes control characters, collapses whitespace, trims and caps length */
export function cleanText(value: string, maxLength: number): string {
  let out = "";
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 32 && code !== 127) out += ch;
    else if (code === 9 || code === 10 || code === 13) out += " ";
  }
  return out.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

/** Codes like invoice / batch numbers: uppercase, no spaces */
export function cleanCode(value: string, maxLength: number): string {
  return cleanText(value, maxLength).replace(/\s+/g, "").toUpperCase();
}

/** While typing a code: keep only A–Z, 0–9, "-" and "/" */
export function toCodeInput(value: string, maxLength: number): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9\-/]/g, "")
    .slice(0, maxLength);
}

/** While typing a whole number */
export function isIntInput(value: string, maxDigits = 6): boolean {
  return new RegExp(`^\\d{0,${maxDigits}}$`).test(value);
}

/** While typing a percentage: 0–100 with up to 2 decimals */
export function isPercentInput(value: string): boolean {
  if (!/^\d{0,3}(\.\d{0,2})?$/.test(value)) return false;
  return value === "" || value === "." || Number(value) <= 100;
}

/** Lenient number parse for live totals — anything invalid becomes 0 */
export function toNumberOrZero(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
