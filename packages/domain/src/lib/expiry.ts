/**
 * Expiry helpers for the "MM/YY" format printed on Indian medicine packs
 * (e.g. "08/27" = August 2027). A medicine is usable until the last day
 * of its expiry month.
 */
const EXPIRY_RE = /^(0[1-9]|1[0-2])\/(\d{2})$/;

export function parseExpiryMMYY(
  value: string,
): { month: number; year: number } | null {
  const m = EXPIRY_RE.exec(value.trim());
  if (!m) return null;
  return { month: Number(m[1]), year: 2000 + Number(m[2]) };
}

export function isValidExpiry(value: string): boolean {
  return parseExpiryMMYY(value) !== null;
}

/** Last moment of the expiry month */
export function expiryEndDate(value: string): Date | null {
  const p = parseExpiryMMYY(value);
  if (!p) return null;
  // Day 0 of the next month = last day of this month
  return new Date(p.year, p.month, 0, 23, 59, 59, 999);
}

export function isExpiryPast(value: string, now = new Date()): boolean {
  const end = expiryEndDate(value);
  return end ? end < now : false;
}

/** Whole months from the current month to the expiry month (0 = expires this month) */
export function monthsToExpiry(value: string, now = new Date()): number | null {
  const p = parseExpiryMMYY(value);
  if (!p) return null;
  return (p.year - now.getFullYear()) * 12 + (p.month - (now.getMonth() + 1));
}

/** Not yet expired, but expires within `days` from now */
export function isExpiringWithin(
  value: string,
  days: number,
  now = new Date(),
): boolean {
  const end = expiryEndDate(value);
  if (!end || end < now) return false;
  // Inclusive of the whole last day of the window
  const limit = new Date(now);
  limit.setDate(limit.getDate() + days);
  limit.setHours(23, 59, 59, 999);
  return end <= limit;
}

/** Sort helper: earlier expiry first; invalid values go last */
export function compareExpiry(a: string, b: string): number {
  const ea = expiryEndDate(a)?.getTime() ?? Number.POSITIVE_INFINITY;
  const eb = expiryEndDate(b)?.getTime() ?? Number.POSITIVE_INFINITY;
  return ea - eb;
}

/** Formats while typing: "0827" → "08/27", keeps at most 4 digits */
export function formatExpiryInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  return digits.length <= 2
    ? digits
    : `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

const MONTHS = "jan feb mar apr may jun jul aug sep oct nov dec".split(" ");

/**
 * Any expiry other software writes → "MM/YY" (or "" if unreadable):
 * "12/26", "12-2026", "Dec-26", "DEC 2026", "2026-12-31", "31/12/2026".
 */
export function toExpiryMMYY(raw: string): string {
  const s = raw.trim().toLowerCase();
  const pad = (m: number) => String(m).padStart(2, "0");
  const yy = (y: string) => y.slice(-2);
  let m: RegExpExecArray | null;
  if ((m = /^(\d{4})[-/.](\d{1,2})[-/.]\d{1,2}/.exec(s)))
    // 2026-12-31
    return checked(pad(+m[2]), yy(m[1]));
  if ((m = /^\d{1,2}[-/.](\d{1,2})[-/.](\d{2,4})$/.exec(s)))
    // 31/12/2026
    return checked(pad(+m[1]), yy(m[2]));
  if ((m = /^(\d{1,2})[-/. ](\d{2}|\d{4})$/.exec(s)))
    // 12/26, 12-2026
    return checked(pad(+m[1]), yy(m[2]));
  if ((m = /^([a-z]{3})[a-z]*[-/. ']*(\d{2}|\d{4})$/.exec(s))) {
    const i = MONTHS.indexOf(m[1]); // Dec-26, DEC 2026
    return i >= 0 ? checked(pad(i + 1), yy(m[2])) : "";
  }
  return "";
}

function checked(mm: string, yy: string) {
  const v = `${mm}/${yy}`;
  return isValidExpiry(v) ? v : "";
}
