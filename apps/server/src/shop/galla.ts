/**
 * Galla (cash drawer): days, cash entries and the expected cash — worked
 * out HERE from the bills, so the number the cashier is checked against
 * can't be changed from a counter. See @medicare/domain/cash/galla.
 */
import type { DatabaseSync } from "node:sqlite";
import type { FastifyRequest } from "fastify";
import {
  businessDate,
  cleanDenominations,
  dayRange,
  summarizeGalla,
  type CashDay,
  type CashEntry,
  type CashKind,
  type CashSource,
  type GallaSummary,
} from "@medicare/domain/cash/galla";
import { hasFeature } from "@medicare/domain/license/plan";
import { newId } from "@medicare/domain/lib/id";
import { RuleError } from "@medicare/domain/lib/errors";
import { loadSales } from "../db/mappers";
import { licenseState, type LicenseOptions } from "../license/state";
import { counterOf } from "../auth/signIns";
import { loadSettings } from "../routes/settings";
import { NotFoundError } from "./errors";

/** One galla per counter (Multi-counter plan) or one for the shop */
export const perCounter = (raw: DatabaseSync, license: LicenseOptions) =>
  hasFeature(licenseState(raw, license).plan, "counterGalla");

/** The shop's counters, as set in Settings (bills carry these names) */
export function shopCounters(raw: DatabaseSync): string[] {
  const s = loadSettings(raw);
  const list = s.counters.length ? s.counters : [s.billing.defaultCounter];
  return [...new Set(list.filter(Boolean))];
}

/**
 * Which galla a request means: one shop galla ("") — or, per counter,
 * the one asked for, else this computer's counter, else the default.
 */
export function gallaOf(
  raw: DatabaseSync,
  license: LicenseOptions,
  req: FastifyRequest,
  asked?: string,
): string {
  if (!perCounter(raw, license)) return "";
  const known = shopCounters(raw);
  const want = (asked ?? "").trim() || counterOf(req);
  if (want && known.includes(want)) return want;
  return loadSettings(raw).billing.defaultCounter || known[0] || "";
}

type DayRow = {
  id: string;
  date: string;
  counter: string;
  status: "open" | "closed";
  opening_paise: number;
  opened_at: string;
  opened_by: string;
  counted_paise: number | null;
  expected_paise: number | null;
  kept_paise: number | null;
  denominations_json: string;
  closed_at: string | null;
  closed_by: string;
  note: string;
};
const toDay = (r: DayRow): CashDay => ({
  id: r.id,
  date: r.date,
  counter: r.counter,
  status: r.status,
  openingPaise: r.opening_paise,
  openedAt: r.opened_at,
  openedBy: r.opened_by,
  countedPaise: r.counted_paise,
  expectedPaise: r.expected_paise,
  keptPaise: r.kept_paise,
  denominations: cleanDenominations(safeJson(r.denominations_json)),
  closedAt: r.closed_at,
  closedBy: r.closed_by,
  note: r.note,
});
function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

type EntryRow = {
  id: string;
  date: string;
  counter: string;
  at: string;
  kind: CashKind;
  category: string;
  amount_paise: number;
  note: string;
  by: string;
  source: CashSource;
  ref: string;
};
const toEntry = (r: EntryRow): CashEntry => ({
  id: r.id,
  date: r.date,
  counter: r.counter,
  at: r.at,
  kind: r.kind,
  category: r.category,
  amountPaise: r.amount_paise,
  note: r.note,
  by: r.by,
  source: r.source,
  ref: r.ref,
});

export function getDay(raw: DatabaseSync, date: string, counter: string) {
  const r = raw
    .prepare("SELECT * FROM cash_days WHERE date = ? AND counter = ?")
    .get(date, counter) as DayRow | undefined;
  return r ? toDay(r) : null;
}

export function dayEntries(
  raw: DatabaseSync,
  date: string,
  counter: string,
): CashEntry[] {
  return (
    raw
      .prepare(
        "SELECT * FROM cash_entries WHERE date = ? AND counter = ? ORDER BY at, rowid",
      )
      .all(date, counter) as EntryRow[]
  ).map(toEntry);
}

/** The day's bills at this galla ("" = every counter) */
function daySales(raw: DatabaseSync, date: string, counter: string) {
  const [from, to] = dayRange(date);
  return counter
    ? loadSales(raw, "created_at >= ? AND created_at < ? AND counter = ?", [
        from,
        to,
        counter,
      ])
    : loadSales(raw, "created_at >= ? AND created_at < ?", [from, to]);
}

/**
 * Tomorrow's opening = what was left in the drawer at the last closing
 * of this galla (before `date`). Nothing closed yet → 0.
 */
export function suggestedOpening(
  raw: DatabaseSync,
  date: string,
  counter: string,
): number {
  const r = raw
    .prepare(
      "SELECT kept_paise FROM cash_days WHERE counter = ? AND date < ? AND status = 'closed' ORDER BY date DESC LIMIT 1",
    )
    .get(counter, date) as { kept_paise: number | null } | undefined;
  return r?.kept_paise ?? 0;
}

export type GallaView = {
  date: string;
  counter: string;
  perCounter: boolean;
  counters: string[];
  day: CashDay | null;
  entries: CashEntry[];
  summary: GallaSummary;
  /** Opening to suggest when the day is not started */
  suggestedOpeningPaise: number;
  /** Closed day: cash that moved after closing (bills, refunds…) */
  afterClosePaise: number;
};

export function gallaView(
  raw: DatabaseSync,
  license: LicenseOptions,
  date: string,
  counter: string,
): GallaView {
  const day = getDay(raw, date, counter);
  const suggested = suggestedOpening(raw, date, counter);
  const entries = dayEntries(raw, date, counter);
  const summary = summarizeGalla({
    openingPaise: day ? day.openingPaise : suggested,
    sales: daySales(raw, date, counter),
    entries,
  });
  return {
    date,
    counter,
    perCounter: perCounter(raw, license),
    counters: shopCounters(raw),
    day,
    entries,
    summary,
    suggestedOpeningPaise: suggested,
    afterClosePaise:
      day?.status === "closed" && day.expectedPaise !== null
        ? summary.expectedPaise - day.expectedPaise
        : 0,
  };
}

export function openDay(
  raw: DatabaseSync,
  date: string,
  counter: string,
  openingPaise: number,
  note: string,
  by: string,
): CashDay {
  const now = new Date().toISOString();
  const existing = getDay(raw, date, counter);
  if (existing?.status === "closed")
    throw new RuleError("This day is already closed");
  if (existing) {
    // Correcting the morning count, before closing
    raw
      .prepare(
        "UPDATE cash_days SET opening_paise = ?, note = ?, opened_by = ? WHERE id = ?",
      )
      .run(openingPaise, note, by, existing.id);
  } else {
    raw
      .prepare(
        "INSERT INTO cash_days (id, date, counter, status, opening_paise, opened_at, opened_by, note) VALUES (?, ?, ?, 'open', ?, ?, ?, ?)",
      )
      .run(newId("cday"), date, counter, openingPaise, now, by, note);
  }
  return getDay(raw, date, counter)!;
}

export function addEntry(
  raw: DatabaseSync,
  e: Omit<CashEntry, "id" | "at" | "date"> & { date?: string; at?: Date },
): CashEntry {
  const at = e.at ?? new Date();
  const entry: CashEntry = {
    id: newId("cash"),
    date: e.date ?? businessDate(at),
    counter: e.counter,
    at: at.toISOString(),
    kind: e.kind,
    category: e.category,
    amountPaise: e.amountPaise,
    note: e.note,
    by: e.by,
    source: e.source,
    ref: e.ref,
  };
  raw
    .prepare(
      "INSERT INTO cash_entries (id, date, counter, at, kind, category, amount_paise, note, by, source, ref) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(
      entry.id,
      entry.date,
      entry.counter,
      entry.at,
      entry.kind,
      entry.category,
      entry.amountPaise,
      entry.note,
      entry.by,
      entry.source,
      entry.ref,
    );
  return entry;
}

/** A typed entry entered by mistake (written ones are the audit trail) */
export function removeEntry(raw: DatabaseSync, id: string) {
  const r = raw.prepare("SELECT * FROM cash_entries WHERE id = ?").get(id) as
    EntryRow | undefined;
  if (!r) throw new NotFoundError("Entry not found");
  if (r.source !== "manual")
    throw new RuleError(
      "This entry was made by a refund or payment — undo that instead",
    );
  if (getDay(raw, r.date, r.counter)?.status === "closed")
    throw new RuleError("That day is closed — reopen it first");
  raw.prepare("DELETE FROM cash_entries WHERE id = ?").run(id);
}

export function closeDay(
  raw: DatabaseSync,
  license: LicenseOptions,
  input: {
    date: string;
    counter: string;
    countedPaise: number;
    keptPaise: number;
    denominations: Record<string, number>;
    note: string;
  },
  by: string,
): CashDay {
  if (input.keptPaise > input.countedPaise)
    throw new RuleError("You can't keep more than you counted");
  const view = gallaView(raw, license, input.date, input.counter);
  const now = new Date().toISOString();
  let day = view.day;
  if (day?.status === "closed")
    throw new RuleError("This day is already closed");
  if (!day)
    day = openDay(
      raw,
      input.date,
      input.counter,
      view.suggestedOpeningPaise,
      "",
      by,
    );
  raw
    .prepare(
      `UPDATE cash_days SET status = 'closed', counted_paise = ?, expected_paise = ?, kept_paise = ?,
       denominations_json = ?, closed_at = ?, closed_by = ?, note = ? WHERE id = ?`,
    )
    .run(
      input.countedPaise,
      view.summary.expectedPaise,
      input.keptPaise,
      JSON.stringify(cleanDenominations(input.denominations)),
      now,
      by,
      input.note || day.note,
      day.id,
    );
  return getDay(raw, input.date, input.counter)!;
}

/** Owner: open a closed day again (a late bill, a counting mistake) */
export function reopenDay(raw: DatabaseSync, id: string) {
  const r = raw.prepare("SELECT * FROM cash_days WHERE id = ?").get(id) as
    DayRow | undefined;
  if (!r) throw new NotFoundError("Day not found");
  raw
    .prepare(
      `UPDATE cash_days SET status = 'open', counted_paise = NULL, expected_paise = NULL, kept_paise = NULL,
       closed_at = NULL, closed_by = '' WHERE id = ?`,
    )
    .run(id);
  return toDay({
    ...r,
    status: "open",
    counted_paise: null,
    expected_paise: null,
    kept_paise: null,
    closed_at: null,
    closed_by: "",
  });
}

/** Days between two dates (newest first) — the Reports history */
export function dayHistory(raw: DatabaseSync, from: string, to: string) {
  return (
    raw
      .prepare(
        "SELECT * FROM cash_days WHERE date >= ? AND date <= ? ORDER BY date DESC, counter",
      )
      .all(from, to) as DayRow[]
  ).map(toDay);
}

/** Days before today still open (forgot to close) */
export function openDaysBefore(raw: DatabaseSync, date: string) {
  return (
    raw
      .prepare(
        "SELECT * FROM cash_days WHERE status = 'open' AND date < ? ORDER BY date DESC LIMIT 20",
      )
      .all(date) as DayRow[]
  ).map(toDay);
}
