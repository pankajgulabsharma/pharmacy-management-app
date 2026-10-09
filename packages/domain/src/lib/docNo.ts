/**
 * Document numbers the way Indian billing software does them — one
 * series per FINANCIAL YEAR (1 April → 31 March), restarting at 0001:
 *
 *   INV/26-27/0001   bill (tax invoice)
 *   SR/26-27/0001    sales return (credit note)
 *   DN/26-27/0001    return to supplier (debit note)
 *
 * GST rule: at most 16 characters, only letters, digits, "/" and "-",
 * unique within the financial year. A prefix of up to 5 characters keeps
 * every number within 16 (INV/26-27/12345 = 15).
 *
 * Shops that already have bills from this year in the old style
 * ("INV-0816") simply continue the count: INV/26-27/0817.
 */

export type FinancialYear = {
  /** "26-27" */
  label: string;
  /** 1 April 00:00 (local time) */
  from: Date;
  /** Next 1 April 00:00 — the year ends just before this */
  to: Date;
};

/** The financial year a date falls in (April → March) */
export function financialYear(d: Date = new Date()): FinancialYear {
  const start = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  const yy = (y: number) => String(y % 100).padStart(2, "0");
  return {
    label: `${yy(start)}-${yy(start + 1)}`,
    from: new Date(start, 3, 1),
    to: new Date(start + 1, 3, 1),
  };
}

/** Bill prefix: 1–5 letters/digits, starting with a letter ("INV", "MC") */
export const DOC_PREFIX_RE = /^[A-Z][A-Z0-9]{0,4}$/;

export function cleanPrefix(raw: unknown, fallback: string): string {
  const p = String(raw ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 5);
  return DOC_PREFIX_RE.test(p) ? p : fallback;
}

export const formatDocNo = (prefix: string, fy: FinancialYear, n: number) =>
  `${prefix}/${fy.label}/${String(n).padStart(4, "0")}`;

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\/-]/g, "\\$&");

/**
 * Next number in this financial year's series. `docs` = numbers already
 * used (with their date); only this year's count, in either style.
 */
export function nextDocNo(
  docs: readonly { no: string; at: string }[],
  prefix: string,
  now: Date = new Date(),
): string {
  const fy = financialYear(now);
  const current = new RegExp(`^${esc(prefix)}/${esc(fy.label)}/(\\d+)$`);
  const legacy = new RegExp(`^${esc(prefix)}-(\\d+)$`);
  let max = 0;
  for (const d of docs) {
    let m = current.exec(d.no);
    if (!m) {
      const t = Date.parse(d.at);
      if (t >= fy.from.getTime() && t < fy.to.getTime()) m = legacy.exec(d.no);
    }
    const n = Number(m?.[1] ?? 0);
    if (n > max) max = n;
  }
  return formatDocNo(prefix, fy, max + 1);
}

/** Bills start with this unless the shop sets its own (Settings → Billing) */
export const DEFAULT_BILL_PREFIX = "INV";
