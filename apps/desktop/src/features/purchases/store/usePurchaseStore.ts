import { create } from "zustand";
import { useInventoryStore } from "@/features/inventory/store/useInventoryStore";
import { checkReversal } from "@/features/inventory/utils/ledger";
import { demoPurchases, demoReturns } from "@/app/demo/seed";
import { cleanText } from "@/lib/sanitize";
import type { Paise } from "@/lib/money";
import type { Purchase, PurchaseReturn, PurchaseReturnInput } from "../types";
import { getDuePaise } from "../utils/calc";
import { purchaseToStockReceipt } from "../utils/receipt";
import {
  buildPurchaseReturn,
  getReturnableLines,
  nextReturnNo,
} from "../utils/returns";
import {
  canCancelPurchase,
  canEditPurchase,
  canRecordPayment,
  canReturnPurchase,
  type PurchaseRuleContext,
  type RuleResult,
} from "../utils/rules";

export class PurchaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PurchaseError";
  }
}

/**
 * Purchase invoices, supplier payments and purchase returns (debit notes).
 *
 * Every operation that touches stock does it FIRST; the document is saved
 * only if the stock change succeeded, so the two can never disagree.
 */
type PurchaseState = {
  purchases: Purchase[];
  /** Debit notes, newest first */
  returns: PurchaseReturn[];

  /** Returns how many packs were added to inventory. Throws on invalid data. */
  addPurchase: (purchase: Purchase) => number;
  /** Replaces an invoice with its edited version (stock re-posted). */
  updatePurchase: (next: Purchase) => void;
  /** Voids an invoice and takes its stock back out. Kept for audit. */
  cancelPurchase: (id: string, reason: string) => void;
  /** Creates a debit note, removes stock and reduces what we owe. */
  createReturn: (input: PurchaseReturnInput) => PurchaseReturn;
  recordPayment: (id: string, amountPaise: Paise) => void;
};

/** Rule context from current stock + returns (shared with the UI hook) */
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

function enforce(rule: RuleResult) {
  if (!rule.allowed) throw new PurchaseError(rule.reason);
}

function assertUniqueInvoice(list: readonly Purchase[], p: Purchase) {
  const invoice = p.invoiceNo.toUpperCase();
  const clash = list.some(
    (x) =>
      x.id !== p.id &&
      x.status !== "cancelled" &&
      x.supplierId === p.supplierId &&
      x.invoiceNo.toUpperCase() === invoice,
  );
  if (clash) {
    throw new PurchaseError(
      `Invoice ${p.invoiceNo} is already entered for this supplier`,
    );
  }
}

export const usePurchaseStore = create<PurchaseState>()((set, get) => ({
  purchases: demoPurchases,
  returns: demoReturns,

  addPurchase: (purchase) => {
    const { purchases } = get();
    if (purchases.some((p) => p.id === purchase.id)) {
      throw new PurchaseError("This purchase is already saved");
    }
    assertUniqueInvoice(purchases, purchase);

    // 1) Stock first (throws StockError and stops here if anything is wrong)
    const packs = useInventoryStore
      .getState()
      .receive(purchaseToStockReceipt(purchase));
    // 2) Then the invoice
    set({ purchases: [purchase, ...purchases] });
    return packs;
  },

  updatePurchase: (next) => {
    const { purchases, returns } = get();
    const current = purchases.find((p) => p.id === next.id);
    if (!current) throw new PurchaseError("Purchase not found");
    enforce(canEditPurchase(current, getRuleContext(current, returns)));

    // Payments and history can't be changed through an edit
    if (
      next.paidPaise !== current.paidPaise ||
      next.returnedPaise !== current.returnedPaise
    ) {
      throw new PurchaseError(
        "Payments can't be changed by editing the invoice",
      );
    }
    if (next.totals.netPaise < current.paidPaise) {
      throw new PurchaseError("New total is less than the amount already paid");
    }
    if (next.revision !== current.revision + 1) {
      throw new PurchaseError(
        "This invoice was changed elsewhere — reopen it and try again",
      );
    }
    assertUniqueInvoice(purchases, next);

    useInventoryStore
      .getState()
      .replaceReceipt(
        purchaseToStockReceipt(next),
        `Edit of ${current.invoiceNo} (rev ${next.revision})`,
      );
    set({ purchases: purchases.map((p) => (p.id === next.id ? next : p)) });
  },

  cancelPurchase: (id, reason) => {
    const { purchases, returns } = get();
    const current = purchases.find((p) => p.id === id);
    if (!current) throw new PurchaseError("Purchase not found");
    enforce(canCancelPurchase(current, getRuleContext(current, returns)));

    const why = cleanText(reason, 200);
    if (!why) throw new PurchaseError("Please give a reason for cancelling");

    useInventoryStore
      .getState()
      .reverseReceipt(id, `Cancelled ${current.invoiceNo}: ${why}`);

    const now = new Date().toISOString();
    set({
      purchases: purchases.map((p) =>
        p.id === id
          ? {
              ...p,
              status: "cancelled",
              cancelledAt: now,
              cancelReason: why,
              updatedAt: now,
            }
          : p,
      ),
    });
  },

  createReturn: (input) => {
    const { purchases, returns } = get();
    const purchase = purchases.find((p) => p.id === input.purchaseId);
    if (!purchase) throw new PurchaseError("Purchase not found");
    enforce(canReturnPurchase(purchase));

    const inventory = useInventoryStore.getState();
    const returnable = getReturnableLines(purchase, returns, inventory.batches);
    const now = new Date();
    const { ret, issue } = buildPurchaseReturn(
      purchase,
      input,
      returnable,
      nextReturnNo(returns),
      now,
    );

    // 1) Stock out first
    inventory.issue({
      refId: ret.id,
      type: "purchase_return",
      note: `Return ${ret.returnNo} · ${ret.supplierName}`,
      at: now,
      lines: issue,
    });
    // 2) Then the debit note + reduce what we owe
    set({
      returns: [ret, ...returns],
      purchases: purchases.map((p) =>
        p.id === purchase.id
          ? {
              ...p,
              returnedPaise: p.returnedPaise + ret.totalPaise,
              updatedAt: now.toISOString(),
            }
          : p,
      ),
    });
    return ret;
  },

  recordPayment: (id, amountPaise) => {
    if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
      throw new PurchaseError("Enter a valid amount");
    }
    const target = get().purchases.find((p) => p.id === id);
    if (!target) throw new PurchaseError("Purchase not found");
    enforce(canRecordPayment(target));
    if (amountPaise > getDuePaise(target)) {
      throw new PurchaseError("Amount is more than the balance");
    }

    set((s) => ({
      purchases: s.purchases.map((p) =>
        p.id === id
          ? {
              ...p,
              paidPaise: p.paidPaise + amountPaise,
              updatedAt: new Date().toISOString(),
            }
          : p,
      ),
    }));
  },
}));
