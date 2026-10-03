import { create } from "zustand";
import { useMedicineStore } from "@/features/medicines/store/useMedicineStore";
import { mockStockBatches } from "../data/mockStock";
import type { StockBatch, StockMovement, StockReceipt } from "../types";
import {
  StockError,
  applyAdjustment,
  applyReceipt,
  openingMovements,
} from "../utils/ledger";

/**
 * Stock — single source of truth for "how much of which batch we have".
 * All changes go through the pure ledger functions and are logged as
 * StockMovements. In memory only (see useMedicineStore for why).
 */
type InventoryState = {
  batches: StockBatch[];
  /** Append-only audit log, newest first */
  movements: StockMovement[];
  /** Source documents already received — makes receive() idempotent */
  receivedRefs: Readonly<Record<string, true>>;

  /**
   * Adds goods to stock. Returns the number of packs added (0 if this
   * document was already received). Throws StockError on invalid data.
   */
  receive: (receipt: StockReceipt) => number;

  /** Sets a batch to a counted quantity. Returns false when nothing changed. */
  adjust: (
    batchId: string,
    target: { qtyStrip: number; qtyLoose: number },
    reason: string,
  ) => boolean;
};

export const useInventoryStore = create<InventoryState>()((set, get) => ({
  batches: mockStockBatches,
  movements: openingMovements(mockStockBatches).reverse(),
  receivedRefs: {},

  receive: (receipt) => {
    const state = get();
    if (state.receivedRefs[receipt.refId]) return 0;

    const known = new Set(
      useMedicineStore.getState().medicines.map((m) => m.id),
    );
    const { batches, movements } = applyReceipt(state.batches, receipt, known);

    set({
      batches,
      movements: [...movements.reverse(), ...state.movements],
      receivedRefs: { ...state.receivedRefs, [receipt.refId]: true },
    });
    return receipt.lines.reduce((sum, l) => sum + l.packs, 0);
  },

  adjust: (batchId, target, reason) => {
    const state = get();
    const batch = state.batches.find((b) => b.id === batchId);
    if (!batch) throw new StockError("Batch not found");

    const result = applyAdjustment(batch, target, reason, new Date());
    if (!result) return false;

    set({
      batches: state.batches.map((b) => (b.id === batchId ? result.batch : b)),
      movements: [result.movement, ...state.movements],
    });
    return true;
  },
}));
