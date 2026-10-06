import { addDays, parseISODate, startOfDay, toISODate } from "@medicare/domain/lib/date";

export type RangePreset =
  | "today"
  | "yesterday"
  | "last7"
  | "thisMonth"
  | "lastMonth"
  | "last90"
  | "custom";

export const RANGE_PRESET_LABELS: Record<RangePreset, string> = {
  today: "Today",
  yesterday: "Yesterday",
  last7: "Last 7 days",
  thisMonth: "This month",
  lastMonth: "Last month",
  last90: "Last 90 days",
  custom: "Custom",
};

/** Inclusive range: from 00:00 of `from` to the end of `to` */
export type DateRange = { from: Date; to: Date };

function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export function resolveRange(
  preset: RangePreset,
  custom: { from: string; to: string },
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
    case "last7":
      return { from: addDays(today, -6), to: endOfDay(today) };
    case "thisMonth":
      return {
        from: new Date(today.getFullYear(), today.getMonth(), 1),
        to: endOfDay(today),
      };
    case "lastMonth": {
      const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const to = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from, to: endOfDay(to) };
    }
    case "last90":
      return { from: addDays(today, -89), to: endOfDay(today) };
    case "custom": {
      const f = parseISODate(custom.from) ?? today;
      const t = parseISODate(custom.to) ?? today;
      // Swap if entered backwards
      return f <= t
        ? { from: f, to: endOfDay(t) }
        : { from: t, to: endOfDay(f) };
    }
  }
}

export function inRange(value: Date, r: DateRange): boolean {
  return value >= r.from && value <= r.to;
}

/** "YYYY-MM-DD" business date in range */
export function isoDateInRange(iso: string, r: DateRange): boolean {
  const d = parseISODate(iso);
  return d ? inRange(d, r) : false;
}

/** Every calendar day in the range (for charts), capped for safety */
export function daysIn(r: DateRange, max = 366): string[] {
  const out: string[] = [];
  for (
    let d = startOfDay(r.from);
    d <= r.to && out.length < max;
    d = addDays(d, 1)
  ) {
    out.push(toISODate(d));
  }
  return out;
}

export function rangeLabel(r: DateRange): string {
  const f = new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const a = f.format(r.from);
  const b = f.format(r.to);
  return a === b ? a : `${a} – ${b}`;
}
