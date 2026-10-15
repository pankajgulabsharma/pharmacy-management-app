/**
 * "What was sold (or returned), day by day" — every medicine, not just the
 * top 10: how many packs / loose units, on how many bills, for how much.
 * Newest day first; inside a day the biggest amount first.
 */
import type { Sale, SaleReturn } from "../billing/types";
import { toISODate } from "../lib/date";
import type { Paise } from "../lib/money";
import { inRange, type DateRange } from "./period";

export type ItemRow = {
  medicineId: string;
  name: string;
  unit: string;
  qtyStrip: number;
  qtyLoose: number;
  /** Bills (or returns) this medicine was on */
  docs: number;
  amountPaise: Paise;
};

export type DayItems = {
  /** "YYYY-MM-DD" */
  date: string;
  /** Bills (or returns) that day */
  docs: number;
  /** Sum of the medicine rows below */
  amountPaise: Paise;
  /** What the bills came to (rows + each bill's round-off to the rupee) */
  billedPaise: Paise;
  items: ItemRow[];
};

type Doc = {
  createdAt: string;
  lines: readonly {
    medicineId: string;
    medicineName: string;
    unit: string;
    qtyStrip: number;
    qtyLoose: number;
    amountPaise: Paise;
  }[];
  totalPaise: Paise;
};

function group(docs: readonly Doc[], range: DateRange): DayItems[] {
  const days = new Map<
    string,
    { docs: number; billedPaise: number; items: Map<string, ItemRow> }
  >();
  for (const d of docs) {
    if (!inRange(d.createdAt, range)) continue;
    const date = toISODate(new Date(d.createdAt));
    let day = days.get(date);
    if (!day) {
      day = { docs: 0, billedPaise: 0, items: new Map() };
      days.set(date, day);
    }
    day.docs++;
    day.billedPaise += d.totalPaise;
    const seen = new Set<string>();
    for (const l of d.lines) {
      if (l.qtyStrip + l.qtyLoose === 0) continue;
      const row = day.items.get(l.medicineId) ?? {
        medicineId: l.medicineId,
        name: l.medicineName,
        unit: l.unit,
        qtyStrip: 0,
        qtyLoose: 0,
        docs: 0,
        amountPaise: 0,
      };
      row.qtyStrip += l.qtyStrip;
      row.qtyLoose += l.qtyLoose;
      row.amountPaise += l.amountPaise;
      if (!seen.has(l.medicineId)) row.docs++;
      seen.add(l.medicineId);
      day.items.set(l.medicineId, row);
    }
  }
  return [...days.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, d]) => {
      const items = [...d.items.values()].sort(
        (a, b) => b.amountPaise - a.amountPaise || a.name.localeCompare(b.name),
      );
      return {
        date,
        docs: d.docs,
        amountPaise: items.reduce((s, r) => s + r.amountPaise, 0),
        billedPaise: d.billedPaise,
        items,
      };
    });
}

/** Medicines sold per day (bill amounts, after line discounts) */
export const soldByDay = (sales: readonly Sale[], range: DateRange) =>
  group(
    sales.map((s) => ({
      createdAt: s.createdAt,
      lines: s.lines,
      totalPaise: s.totals.netPaise,
    })),
    range,
  );

/** Medicines customers brought back, per day (refund amounts) */
export const returnedByDay = (
  returns: readonly SaleReturn[],
  range: DateRange,
) =>
  group(
    returns.map((r) => ({
      createdAt: r.createdAt,
      lines: r.lines,
      totalPaise: r.refundPaise,
    })),
    range,
  );

/** The same rows added up for the whole period (one line per medicine) */
export function wholePeriod(days: readonly DayItems[]): DayItems | null {
  if (days.length === 0) return null;
  const items = new Map<string, ItemRow>();
  for (const d of days)
    for (const r of d.items) {
      const t = items.get(r.medicineId);
      if (!t) items.set(r.medicineId, { ...r });
      else {
        t.qtyStrip += r.qtyStrip;
        t.qtyLoose += r.qtyLoose;
        t.docs += r.docs;
        t.amountPaise += r.amountPaise;
      }
    }
  return {
    date: "",
    docs: days.reduce((s, d) => s + d.docs, 0),
    amountPaise: days.reduce((s, d) => s + d.amountPaise, 0),
    billedPaise: days.reduce((s, d) => s + d.billedPaise, 0),
    items: [...items.values()].sort(
      (a, b) => b.amountPaise - a.amountPaise || a.name.localeCompare(b.name),
    ),
  };
}
