/**
 * Bring a shop's existing data in (CSV from Excel / Marg / Tally…):
 * medicines, and — when the file has batches — their opening stock.
 * All rows or none. A medicine already in the master (same barcode, or
 * same name) is reused, so re-running an import doesn't duplicate it.
 */
import type { DatabaseSync } from "node:sqlite";
import { applyReceipt, STOCK_LIMITS } from "@medicare/domain/inventory/ledger";
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
            refId: `import_${now.getTime()}_${i}`,
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
    return {
      created: created.length,
      existing: existing.size,
      batches: lines.length,
      patch,
    };
  });
}
