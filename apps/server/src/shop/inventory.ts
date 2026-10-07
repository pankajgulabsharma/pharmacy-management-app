/** Stock count corrections (Inventory → Adjust) */
import type { DatabaseSync } from "node:sqlite";
import { StockError, applyAdjustment } from "@medicare/domain/inventory/ledger";
import { cleanText } from "@medicare/domain/lib/sanitize";
import type { ShopPatch } from "@medicare/domain/shop/patch";
import { batchToRow, loadBatches, movementToRow } from "../db/mappers";
import * as t from "../db/schema";
import { insertRows, updateRow, writeTx } from "../db/sync";

export type AdjustInput = {
  batchId: string;
  qtyStrip: number;
  qtyLoose: number;
  reason: string;
};

export function adjustStock(
  raw: DatabaseSync,
  input: AdjustInput,
  now = new Date(),
): { changed: boolean; patch: ShopPatch } {
  return writeTx(raw, () => {
    const [batch] = loadBatches(raw, "id = ?", [input.batchId]);
    if (!batch) throw new StockError("Batch not found");
    const reason = cleanText(input.reason, 200);
    if (!reason) throw new StockError("Please give a reason");
    const r = applyAdjustment(
      batch,
      { qtyStrip: input.qtyStrip, qtyLoose: input.qtyLoose },
      reason,
      now,
    );
    if (!r) return { changed: false, patch: {} };
    updateRow(raw, t.batches, "id", batchToRow(r.batch));
    insertRows(raw, t.stockMovements, [movementToRow(r.movement)]);
    return {
      changed: true,
      patch: { batches: [r.batch], movements: [r.movement] },
    };
  });
}
