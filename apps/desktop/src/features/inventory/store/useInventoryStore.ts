import { create } from "zustand";
import type {
  StockBatch,
  StockMovement,
} from "@medicare/domain/inventory/types";
import type { ShopPatch } from "@medicare/domain/shop/patch";
import { apiGet, apiRequest, requireServer } from "@/lib/api";
import { applyShopPatch } from "@/stores/applyShopPatch";

/**
 * Stock on the shelf. The server owns it: sales, purchases and returns
 * change stock THERE (one transaction each) and send back what changed.
 * Only purchase receipts are kept from the movement log (to check a
 * purchase cancel) — a batch's full history is read when it is opened.
 */
type InventoryState = {
  batches: StockBatch[];
  /** Purchase receipts from the movement log (shop/history), newest first */
  movements: StockMovement[];
  source: "none" | "server";
  loadFromServer: () => Promise<void>;
  /** Set a batch to a counted quantity. Resolves false when nothing changed. */
  adjust: (
    batchId: string,
    target: { qtyStrip: number; qtyLoose: number },
    reason: string,
  ) => Promise<boolean>;
};

export const useInventoryStore = create<InventoryState>()((set, get) => ({
  batches: [],
  movements: [],
  source: "none",

  loadFromServer: async () => {
    const r = await apiGet<{
      batches: StockBatch[];
      movements: StockMovement[];
    }>("/api/stock?movements=purchase");
    set({ batches: r.batches, movements: r.movements, source: "server" });
  },

  adjust: async (batchId, target, reason) => {
    requireServer(get().source);
    const r = await apiRequest<{ changed: boolean; patch: ShopPatch }>(
      "POST",
      "/api/stock/adjust",
      { batchId, ...target, reason },
    );
    applyShopPatch(r.patch);
    return r.changed;
  },
}));
