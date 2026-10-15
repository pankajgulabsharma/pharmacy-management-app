/**
 * Bring a shop's existing data in (CSV from Excel / Marg / Tally…):
 * medicines, and — when the file has batches — their opening stock.
 * All rows or none. A medicine already in the master (same barcode, or
 * same name) is reused, so re-running an import doesn't duplicate it.
 */
import type { DatabaseSync } from "node:sqlite";
import {
  applyReceipt,
  applyReversal,
  STOCK_LIMITS,
} from "@medicare/domain/inventory/ledger";
import type { StockReceiptLine } from "@medicare/domain/inventory/types";
import { RuleError } from "@medicare/domain/lib/errors";
import { newId } from "@medicare/domain/lib/id";
import { cleanMedicineInput } from "@medicare/domain/medicines/clean";
import type { ImportRow } from "@medicare/domain/medicines/csv";
import type { Medicine } from "@medicare/domain/medicines/types";
import type { ShopPatch } from "@medicare/domain/shop/patch";
import {
  loadBatches,
  loadMedicinesSync,
  loadMovements,
  medicineToRow,
  saveStock,
} from "../db/mappers";
import * as t from "../db/schema";
import { insertRows, writeTx } from "../db/sync";

export function importStock(
  raw: DatabaseSync,
  rows: readonly ImportRow[],
  now = new Date(),
) {
  return writeTx(raw, () => {
    // One id for the whole file: its stock movements carry it (ref_id),
    // so "Undo import" knows exactly what this file added
    const importId = newId("imp");
    const all = loadMedicinesSync(raw);
    const byName = new Map(all.map((m) => [m.name.toLowerCase(), m]));
    const byCode = new Map(
      all.filter((m) => m.barcode).map((m) => [m.barcode, m]),
    );
    const created: Medicine[] = [];
    /** Medicines that were already in the master */
    const existing = new Set<string>();
    const lines: StockReceiptLine[] = [];

    for (const [i, row] of rows.entries()) {
      const input = cleanMedicineInput(row.medicine);
      if (input.name.length < 2)
        throw new RuleError(`Row ${i + 1}: name is required`);
      if (input.mrp <= 0)
        throw new RuleError(`Row ${i + 1}: MRP must be more than 0`);
      let m =
        (input.barcode && byCode.get(input.barcode)) ||
        byName.get(input.name.toLowerCase());
      if (m && !created.includes(m)) existing.add(m.id);
      if (!m) {
        m = { id: newId("med"), ...input };
        created.push(m);
        byName.set(m.name.toLowerCase(), m);
        if (m.barcode) byCode.set(m.barcode, m);
      }
      if (row.opening)
        lines.push({
          medicineId: m.id,
          unit: m.unit,
          batchNo: row.opening.batchNo,
          expiry: row.opening.expiry,
          packs: row.opening.qty,
          mrp: row.opening.mrp,
          costPerPack: row.opening.purchasePrice,
        });
    }
    insertRows(raw, t.medicines, created.map(medicineToRow));

    // Opening stock, in receipts of up to 500 lines (same rules as purchases)
    let patch: ShopPatch = {};
    if (lines.length) {
      const before = loadBatches(raw);
      const known = new Set([...byName.values()].map((m) => m.id));
      let batches = before;
      const movements = [];
      for (let i = 0; i < lines.length; i += STOCK_LIMITS.maxReceiptLines) {
        const r = applyReceipt(
          batches,
          {
            refId: importId,
            type: "opening",
            note: "Opening stock (imported)",
            at: now,
            lines: lines.slice(i, i + STOCK_LIMITS.maxReceiptLines),
          },
          known,
        );
        batches = r.batches;
        movements.push(...r.movements);
      }
      patch = saveStock(raw, before, batches, movements);
    }
    insertRows(raw, t.medicineImports, [
      {
        id: importId,
        at: now.toISOString(),
        rows: rows.length,
        createdIdsJson: JSON.stringify(created.map((m) => m.id)),
        existingCount: existing.size,
        batchLines: lines.length,
        undoneAt: "",
      },
    ]);
    return {
      importId,
      created: created.length,
      existing: existing.size,
      batches: lines.length,
      patch,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Undo an import                                                      */
/* ------------------------------------------------------------------ */

export type MedicineImport = {
  id: string;
  at: string;
  rows: number;
  created: number;
  existing: number;
  batches: number;
  undoneAt: string;
};

type ImportRowDb = {
  id: string;
  at: string;
  rows: number;
  created_ids_json: string;
  existing_count: number;
  batch_lines: number;
  undone_at: string;
};

const createdIds = (r: ImportRowDb): string[] => {
  try {
    const v = JSON.parse(r.created_ids_json) as unknown;
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
};

const toImport = (r: ImportRowDb): MedicineImport => ({
  id: r.id,
  at: r.at,
  rows: r.rows,
  created: createdIds(r).length,
  existing: r.existing_count,
  batches: r.batch_lines,
  undoneAt: r.undone_at,
});

/** Latest imports first (the Import window lists them with Undo) */
export function listImports(raw: DatabaseSync, limit = 10): MedicineImport[] {
  return (
    raw
      .prepare("SELECT * FROM medicine_imports ORDER BY at DESC LIMIT ?")
      .all(limit) as ImportRowDb[]
  ).map(toImport);
}

/**
 * Takes a whole import back out — the new medicines it created and the
 * opening stock it added — as long as nothing from it has been used:
 *  - a NEW medicine must not be on any bill, purchase, held bill, or have
 *    stock changes other than this import (otherwise its history must stay)
 *  - stock added to medicines that were already there must still be on
 *    the shelf (not sold, returned or adjusted away)
 * All or nothing; the reason is given when it can't be done.
 */
export function undoImport(raw: DatabaseSync, id: string, now = new Date()) {
  return writeTx(raw, () => {
    const row = raw
      .prepare("SELECT * FROM medicine_imports WHERE id = ?")
      .get(id) as ImportRowDb | undefined;
    if (!row) throw new RuleError("Import not found");
    if (row.undone_at) throw new RuleError("This import was already undone");

    const created = new Set(createdIds(row));
    const names = new Map(
      loadMedicinesSync(raw)
        .filter((m) => created.has(m.id))
        .map((m) => [m.id, m.name]),
    );
    const one = (sql: string, ...p: string[]) =>
      raw.prepare(sql).get(...p) !== undefined;
    const used = [...created].filter(
      (mid) =>
        names.has(mid) &&
        (one(
          "SELECT 1 FROM stock_movements WHERE medicine_id = ? AND ref_id <> ? LIMIT 1",
          mid,
          id,
        ) ||
          one("SELECT 1 FROM sale_lines WHERE medicine_id = ? LIMIT 1", mid) ||
          one(
            "SELECT 1 FROM purchase_lines WHERE medicine_id = ? LIMIT 1",
            mid,
          ) ||
          one(
            "SELECT 1 FROM held_bills WHERE lines_json LIKE ? LIMIT 1",
            `%"medicineId":"${mid}"%`,
          )),
    );
    if (used.length) {
      const list = used
        .slice(0, 3)
        .map((mid) => names.get(mid))
        .join(", ");
      throw new RuleError(
        `Can't undo: ${list}${used.length > 3 ? ` and ${used.length - 3} more` : ""} already used since the import (sold, purchased, adjusted or on a held bill). Fix those medicines one by one instead.`,
      );
    }

    // Stock this file added to medicines that were already in the list
    const before = loadBatches(raw);
    const reversed = applyReversal(
      before,
      loadMovements(raw, "ref_id = ?", [id]),
      id,
      "Import undone",
      now,
      "opening_reversal",
    );
    const isNew = (mid: string) => created.has(mid);
    const saved = saveStock(
      raw,
      before.filter((b) => !isNew(b.medicineId)),
      reversed.batches.filter((b) => !isNew(b.medicineId)),
      reversed.movements.filter((m) => !isNew(m.medicineId)),
    );

    // New medicines go completely: their batches only ever held this file
    const gone = before.filter((b) => isNew(b.medicineId)).map((b) => b.id);
    for (const mid of created) {
      raw.prepare("DELETE FROM stock_movements WHERE medicine_id = ?").run(mid);
      raw.prepare("DELETE FROM batches WHERE medicine_id = ?").run(mid);
      raw.prepare("DELETE FROM medicines WHERE id = ?").run(mid);
    }
    raw
      .prepare("UPDATE medicine_imports SET undone_at = ? WHERE id = ?")
      .run(now.toISOString(), id);

    const patch: ShopPatch = { ...saved, batchesRemoved: gone };
    return {
      removed: names.size,
      stockLines: reversed.movements.length,
      patch,
    };
  });
}
