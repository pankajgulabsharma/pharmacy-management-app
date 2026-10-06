import { create } from "zustand";
import { useMedicineStore } from "@/features/medicines/store/useMedicineStore";
import { demoInventory } from "@/app/demo/seed";
import type {
  StockBatch,
  StockChange,
  StockIssue,
  StockMovement,
  StockReceipt,
} from "../types";
import {
  StockError,
  applyAdjustment,
  applyChange,
  applyIssue,
  applyReceipt,
  applyReversal,
} from "../utils/ledger";

/**
 * Stock — single source of truth for "how much of which batch we have".
 * Every change goes through the pure ledger functions and is logged as a
 * StockMovement. In memory only (see useMedicineStore for why).
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

  /** Undo everything a document added (purchase cancel). All-or-nothing. */
  reverseReceipt: (refId: string, note: string) => void;

  /**
   * Replace a document's stock with a corrected version (purchase edit):
   * reverse the old receipt and apply the new one as ONE operation —
   * if the new one is invalid, the reversal is discarded too.
   */
  replaceReceipt: (receipt: StockReceipt, note: string) => number;

  /** Remove stock from specific batches (purchase return). All-or-nothing. */
  issue: (issue: StockIssue) => void;

  /** Exact per-batch deltas (sale / sales return). All-or-nothing. */
  change: (change: StockChange) => void;

  /** Set a batch to a counted quantity. Returns false when nothing changed. */
  adjust: (
    batchId: string,
    target: { qtyStrip: number; qtyLoose: number },
    reason: string,
  ) => boolean;
};

function knownMedicineIds() {
  return new Set(useMedicineStore.getState().medicines.map((m) => m.id));
}

function packCount(receipt: StockReceipt) {
  return receipt.lines.reduce((sum, l) => sum + l.packs, 0);
}

export const useInventoryStore = create<InventoryState>()((set, get) => ({
  batches: demoInventory.batches,
  movements: demoInventory.movements,
  receivedRefs: demoInventory.receivedRefs,

  receive: (receipt) => {
    const state = get();
    if (state.receivedRefs[receipt.refId]) return 0;

    const { batches, movements } = applyReceipt(
      state.batches,
      receipt,
      knownMedicineIds(),
    );
    set({
      batches,
      movements: [...movements.reverse(), ...state.movements],
      receivedRefs: { ...state.receivedRefs, [receipt.refId]: true },
    });
    return packCount(receipt);
  },

  reverseReceipt: (refId, note) => {
    const state = get();
    if (!state.receivedRefs[refId]) {
      throw new StockError("No stock was received for this document");
    }
    const r = applyReversal(
      state.batches,
      state.movements,
      refId,
      note,
      new Date(),
    );
    set({
      batches: r.batches,
      movements: [...r.movements.reverse(), ...state.movements],
    });
  },

  replaceReceipt: (receipt, note) => {
    const state = get();
    if (!state.receivedRefs[receipt.refId]) {
      throw new StockError("No stock was received for this document");
    }
    // Both steps run on local copies; the store changes only if both succeed
    const reversed = applyReversal(
      state.batches,
      state.movements,
      receipt.refId,
      note,
      new Date(),
    );
    const received = applyReceipt(
      reversed.batches,
      receipt,
      knownMedicineIds(),
    );
    set({
      batches: received.batches,
      movements: [
        ...received.movements.reverse(),
        ...reversed.movements.reverse(),
        ...state.movements,
      ],
    });
    return packCount(receipt);
  },

  issue: (issue) => {
    const state = get();
    const r = applyIssue(state.batches, issue);
    set({
      batches: r.batches,
      movements: [...r.movements.reverse(), ...state.movements],
    });
  },

  change: (change) => {
    const state = get();
    const r = applyChange(state.batches, change);
    set({
      batches: r.batches,
      movements: [...r.movements.reverse(), ...state.movements],
    });
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
