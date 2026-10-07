import { create } from "zustand";
import { checkReversal } from "@medicare/domain/inventory/ledger";
import type { Paise } from "@medicare/domain/lib/money";
import type {
  Purchase,
  PurchaseDraft,
  PurchaseReturn,
  PurchaseReturnInput,
} from "@medicare/domain/purchases/types";
import type { PurchaseRuleContext } from "@medicare/domain/purchases/rules";
import type { ShopPatch } from "@medicare/domain/shop/patch";
import { useInventoryStore } from "@/features/inventory/store/useInventoryStore";
import { apiGet, apiRequest, requireServer } from "@/lib/api";
import { applyShopPatch } from "@/stores/applyShopPatch";

/**
 * Supplier invoices, payments and debit notes. The SERVER checks every rule
 * and changes stock + invoice together; this store sends the form and
 * merges what the server saved.
 */
type PurchaseState = {
  purchases: Purchase[];
  /** Debit notes, newest first */
  returns: PurchaseReturn[];
  source: "none" | "server";
  loadFromServer: () => Promise<void>;
  /** Send the form as typed; the server builds and checks the invoice. Resolves packs added. */
  addPurchase: (
    draft: PurchaseDraft,
  ) => Promise<{ purchase: Purchase; packs: number }>;
  updatePurchase: (
    id: string,
    draft: PurchaseDraft,
    revision: number,
  ) => Promise<Purchase>;
  cancelPurchase: (id: string, reason: string) => Promise<void>;
  createReturn: (input: PurchaseReturnInput) => Promise<PurchaseReturn>;
  recordPayment: (id: string, amountPaise: Paise) => Promise<void>;
};

/** Rule context from current stock + returns (the UI shows why a button is off) */
export function getRuleContext(
  purchase: Purchase,
  returns: readonly PurchaseReturn[],
): PurchaseRuleContext {
  const { batches, movements } = useInventoryStore.getState();
  return {
    returnCount: returns.filter((r) => r.purchaseId === purchase.id).length,
    stockReversible:
      !purchase.stockPosted ||
      checkReversal(batches, movements, purchase.id).length === 0,
  };
}

/** POST/PUT, then merge what the server saved */
async function send<R extends { patch: ShopPatch }>(
  method: "POST" | "PUT",
  path: string,
  body: unknown,
): Promise<R> {
  requireServer(usePurchaseStore.getState().source);
  const r = await apiRequest<R>(method, path, body);
  applyShopPatch(r.patch);
  return r;
}

export const usePurchaseStore = create<PurchaseState>()((set) => ({
  purchases: [],
  returns: [],
  source: "none",

  loadFromServer: async () => {
    const r = await apiGet<{
      purchases: Purchase[];
      returns: PurchaseReturn[];
    }>("/api/purchases");
    set({ purchases: r.purchases, returns: r.returns, source: "server" });
  },

  addPurchase: (draft) =>
    send<{ purchase: Purchase; packs: number; patch: ShopPatch }>(
      "POST",
      "/api/purchases",
      draft,
    ),
  updatePurchase: async (id, draft, revision) =>
    (
      await send<{ purchase: Purchase; patch: ShopPatch }>(
        "PUT",
        `/api/purchases/${encodeURIComponent(id)}`,
        { draft, revision },
      )
    ).purchase,
  cancelPurchase: async (id, reason) => {
    await send("POST", `/api/purchases/${encodeURIComponent(id)}/cancel`, {
      reason,
    });
  },
  createReturn: async (input) =>
    (
      await send<{ ret: PurchaseReturn; patch: ShopPatch }>(
        "POST",
        "/api/purchase-returns",
        input,
      )
    ).ret,
  recordPayment: async (id, amountPaise) => {
    await send("POST", `/api/purchases/${encodeURIComponent(id)}/payments`, {
      amountPaise,
    });
  },
}));
