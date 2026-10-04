import { addDays, parseISODate, startOfDay, toISODate } from "@/lib/date";

export type PeriodPreset =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "90d"
  | "month"
  | "lastMonth"
  | "custom";

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 3 months",
  month: "This month",
  lastMonth: "Last month",
  custom: "Custom",
};

/** Inclusive date range [from 00:00, to 23:59:59.999] in local time */
export type DateRange = { from: Date; to: Date };

const endOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

export function presetRange(
  preset: Exclude<PeriodPreset, "custom">,
  now = new Date(),
): DateRange {
  const today = startOfDay(now);
  switch (preset) {
    case "today":
      return { from: today, to: endOfDay(today) };
    case "yesterday": {
      const y = addDays(today, -1);
      return { from: y, to: endOfDay(y) };
    }
    case "7d":
      return { from: addDays(today, -6), to: endOfDay(today) };
    case "30d":
      return { from: addDays(today, -29), to: endOfDay(today) };
    case "90d":
      return { from: addDays(today, -89), to: endOfDay(today) };
    case "month":
      return {
        from: new Date(today.getFullYear(), today.getMonth(), 1),
        to: endOfDay(today),
      };
    case "lastMonth": {
      const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const to = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from, to: endOfDay(to) };
    }
  }
}

/** Custom range from two "YYYY-MM-DD" values; null when invalid */
export function customRange(fromISO: string, toISO: string): DateRange | null {
  const from = parseISODate(fromISO);
  const to = parseISODate(toISO);
  if (!from || !to || from > to) return null;
  return { from, to: endOfDay(to) };
}

export function inRange(value: Date | string, r: DateRange): boolean {
  const d = typeof value === "string" ? parseDay(value) : value;
  return d !== null && d >= r.from && d <= r.to;
}

/** "YYYY-MM-DD" (a business date) or a full ISO timestamp */
function parseDay(v: string): Date | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? parseISODate(v) : new Date(v);
}

/** Every calendar day in the range, as "YYYY-MM-DD" */
export function daysIn(r: DateRange): string[] {
  const out: string[] = [];
  for (
    let d = startOfDay(r.from);
    d <= r.to && out.length < 400;
    d = addDays(d, 1)
  ) {
    out.push(toISODate(d));
  }
  return out;
}

export function describeRange(r: DateRange): string {
  const f = new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const a = f.format(r.from);
  const b = f.format(r.to);
  return a === b ? a : `${a} – ${b}`;
}
