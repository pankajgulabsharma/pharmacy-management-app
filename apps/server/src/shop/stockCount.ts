/**
 * Stock count on the server: snapshot, counts typed on any counter, and
 * posting the differences as stock adjustments in ONE transaction.
 */
import type { DatabaseSync } from "node:sqlite";
import { newId } from "@medicare/domain/lib/id";
import { RuleError } from "@medicare/domain/lib/errors";
import { cleanText } from "@medicare/domain/lib/sanitize";
import { applyAdjustment, StockError } from "@medicare/domain/inventory/ledger";
import {
  countNo,
  isCounted,
  NO_RACK,
  postTarget,
  rackLabel,
  summarizeCount,
  type CountSummary,
  type StockCount,
  type StockCountLine,
} from "@medicare/domain/inventory/stockCount";
import type { ShopPatch } from "@medicare/domain/shop/patch";
import type {
  StockBatch,
  StockMovement,
} from "@medicare/domain/inventory/types";
import {
  batchToRow,
  loadBatches,
  loadMedicinesSync,
  movementToRow,
} from "../db/mappers";
import * as t from "../db/schema";
import { insertRows, updateRow, writeTx } from "../db/sync";
import { NotFoundError } from "./errors";

type CountRow = {
  id: string;
  count_no: string;
  racks_json: string;
  status: StockCount["status"];
  note: string;
  created_at: string;
  created_by: string;
  posted_at: string | null;
  posted_by: string;
  summary_json: string | null;
};
type LineRow = {
  count_id: string;
  batch_id: string;
  medicine_id: string;
  system_strip: number;
  system_loose: number;
  counted_strip: number | null;
  counted_loose: number | null;
  counted_by: string;
  counted_at: string | null;
};

const json = <T>(s: string | null, fallback: T): T => {
  try {
    return s ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
};
const toCount = (r: CountRow): StockCount => ({
  id: r.id,
  countNo: r.count_no,
  racks: json<string[]>(r.racks_json, []),
  status: r.status,
  note: r.note,
  createdAt: r.created_at,
  createdBy: r.created_by,
  postedAt: r.posted_at,
  postedBy: r.posted_by,
  summary: json<CountSummary | null>(r.summary_json, null),
});
const toLine = (r: LineRow): StockCountLine => ({
  countId: r.count_id,
  batchId: r.batch_id,
  medicineId: r.medicine_id,
  systemStrip: r.system_strip,
  systemLoose: r.system_loose,
  countedStrip: r.counted_strip,
  countedLoose: r.counted_loose,
  countedBy: r.counted_by,
  countedAt: r.counted_at,
});

export function listCounts(raw: DatabaseSync): StockCount[] {
  return (
    raw
      .prepare("SELECT * FROM stock_counts ORDER BY created_at DESC LIMIT 200")
      .all() as CountRow[]
  ).map(toCount);
}

export function getCount(raw: DatabaseSync, id: string) {
  const r = raw.prepare("SELECT * FROM stock_counts WHERE id = ?").get(id) as
    CountRow | undefined;
  if (!r) throw new NotFoundError("Stock count not found");
  const lines = (
    raw
      .prepare("SELECT * FROM stock_count_lines WHERE count_id = ?")
      .all(id) as LineRow[]
  ).map(toLine);
  return { count: toCount(r), lines };
}

/** Every rack in use (for the "which racks" picker), "" = no rack */
export function racksInUse(raw: DatabaseSync): string[] {
  const set = new Set(loadMedicinesSync(raw).map((m) => m.rack.trim()));
  return [...set].sort((a, b) =>
    a === NO_RACK
      ? 1
      : b === NO_RACK
        ? -1
        : a.localeCompare(b, "en", { numeric: true }),
  );
}

export function startCount(
  raw: DatabaseSync,
  input: { racks: string[]; includeEmpty: boolean; note: string },
  by: string,
  now = new Date(),
) {
  return writeTx(raw, () => {
    const open = raw
      .prepare("SELECT count_no FROM stock_counts WHERE status = 'open'")
      .get() as { count_no: string } | undefined;
    if (open)
      throw new RuleError(
        `Count ${open.count_no} is still open — post or cancel it first`,
      );
    const racks = [...new Set(input.racks.map((r) => r.trim()))];
    const meds = new Map(
      loadMedicinesSync(raw)
        .filter((m) => racks.length === 0 || racks.includes(m.rack.trim()))
        .map((m) => [m.id, m]),
    );
    const batches = loadBatches(raw).filter(
      (b) =>
        meds.has(b.medicineId) &&
        (input.includeEmpty || b.qtyStrip > 0 || b.qtyLoose > 0),
    );
    if (batches.length === 0)
      throw new RuleError(
        racks.length
          ? `No stock on ${racks.map(rackLabel).join(", ")}`
          : "No stock to count",
      );
    const n =
      (
        raw.prepare("SELECT count(*) n FROM stock_counts").get() as {
          n: number;
        }
      ).n + 1;
    const id = newId("sc");
    raw
      .prepare(
        "INSERT INTO stock_counts (id, count_no, racks_json, status, note, created_at, created_by) VALUES (?, ?, ?, 'open', ?, ?, ?)",
      )
      .run(
        id,
        countNo(n),
        JSON.stringify(racks),
        cleanText(input.note, 120),
        now.toISOString(),
        by,
      );
    const ins = raw.prepare(
      "INSERT INTO stock_count_lines (count_id, batch_id, medicine_id, system_strip, system_loose) VALUES (?, ?, ?, ?, ?)",
    );
    for (const b of batches)
      ins.run(id, b.id, b.medicineId, b.qtyStrip, b.qtyLoose);
    return getCount(raw, id);
  });
}

const openCount = (raw: DatabaseSync, id: string) => {
  const c = getCount(raw, id);
  if (c.count.status !== "open")
    throw new RuleError(`This count is already ${c.count.status}`);
  return c;
};

/** Typed counts (null = clear); several people can count at once */
export function saveCounts(
  raw: DatabaseSync,
  id: string,
  lines: {
    batchId: string;
    qtyStrip: number | null;
    qtyLoose: number | null;
  }[],
  by: string,
  now = new Date(),
) {
  return writeTx(raw, () => {
    openCount(raw, id);
    const up = raw.prepare(
      "UPDATE stock_count_lines SET counted_strip = ?, counted_loose = ?, counted_by = ?, counted_at = ? WHERE count_id = ? AND batch_id = ?",
    );
    for (const l of lines) {
      const clear = l.qtyStrip === null && l.qtyLoose === null;
      up.run(
        clear ? null : (l.qtyStrip ?? 0),
        clear ? null : (l.qtyLoose ?? 0),
        clear ? "" : by,
        clear ? null : now.toISOString(),
        id,
        l.batchId,
      );
    }
    return getCount(raw, id);
  });
}

export function cancelCount(raw: DatabaseSync, id: string) {
  return writeTx(raw, () => {
    openCount(raw, id);
    raw
      .prepare("UPDATE stock_counts SET status = 'cancelled' WHERE id = ?")
      .run(id);
    return getCount(raw, id);
  });
}

/**
 * Post: each counted difference → a stock adjustment on today's stock.
 * Uncounted batches are left as they are.
 */
export function postCount(
  raw: DatabaseSync,
  id: string,
  by: string,
  now = new Date(),
): { count: StockCount; lines: StockCountLine[]; patch: ShopPatch } {
  return writeTx(raw, () => {
    const { count, lines } = openCount(raw, id);
    if (!lines.some(isCounted))
      throw new RuleError("Nothing has been counted yet");
    const meds = new Map(loadMedicinesSync(raw).map((m) => [m.id, m]));
    const batches = new Map(
      loadBatches(
        raw,
        `id IN (SELECT batch_id FROM stock_count_lines WHERE count_id = ?)`,
        [id],
      ).map((b) => [b.id, b]),
    );
    const changed: StockBatch[] = [];
    const moves: StockMovement[] = [];
    for (const l of lines) {
      if (!isCounted(l)) continue;
      const b = batches.get(l.batchId);
      const m = meds.get(l.medicineId);
      if (!b || !m) continue;
      const target = postTarget(b, l, m);
      if (!target)
        throw new StockError(
          `${m.name} (${b.batchNo}): more was sold after counting than was counted — count it again`,
        );
      const r = applyAdjustment(b, target, `Stock count ${count.countNo}`, now);
      if (!r) continue;
      r.movement.refId = id;
      updateRow(raw, t.batches, "id", batchToRow(r.batch));
      changed.push(r.batch);
      moves.push(r.movement);
    }
    if (moves.length)
      insertRows(raw, t.stockMovements, moves.map(movementToRow));
    const summary = summarizeCount(
      lines,
      (mid) => meds.get(mid),
      (bid) => batches.get(bid)?.purchasePrice ?? 0,
    );
    raw
      .prepare(
        "UPDATE stock_counts SET status = 'posted', posted_at = ?, posted_by = ?, summary_json = ? WHERE id = ?",
      )
      .run(now.toISOString(), by, JSON.stringify(summary), id);
    return {
      ...getCount(raw, id),
      patch: { batches: changed, movements: moves },
    };
  });
}
