import { useMemo } from "react";
import { useInventoryStore } from "@/features/inventory/store/useInventoryStore";
import { checkReversal } from "@/features/inventory/utils/ledger";
import { usePurchaseStore } from "../store/usePurchaseStore";
import type { Purchase } from "../types";
import {
  canCancelPurchase,
  canEditPurchase,
  canRecordPayment,
  canReturnPurchase,
} from "../utils/rules";

/**
 * What the user may do with an invoice right now, and why not.
 * Uses the same rule functions the store enforces.
 */
export function usePurchaseRules(purchase: Purchase | null) {
  const batches = useInventoryStore((s) => s.batches);
  const movements = useInventoryStore((s) => s.movements);
  const returns = usePurchaseStore((s) => s.returns);

  return useMemo(() => {
    if (!purchase) return null;
    const ctx = {
      returnCount: returns.filter((r) => r.purchaseId === purchase.id).length,
      stockReversible:
        !purchase.stockPosted ||
        checkReversal(batches, movements, purchase.id).length === 0,
    };
    return {
      edit: canEditPurchase(purchase, ctx),
      cancel: canCancelPurchase(purchase, ctx),
      return: canReturnPurchase(purchase),
      payment: canRecordPayment(purchase),
      returnCount: ctx.returnCount,
    };
  }, [purchase, batches, movements, returns]);
}
