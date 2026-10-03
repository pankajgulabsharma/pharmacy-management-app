import { create } from "zustand";
import { useInventoryStore } from "@/features/inventory/store/useInventoryStore";
import type { Paise } from "@/lib/money";
import { mockPurchases } from "../data/mockPurchases";
import type { Purchase } from "../types";
import { getDuePaise } from "../utils/calc";
import { purchaseToStockReceipt } from "../utils/receipt";

export class PurchaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PurchaseError";
  }
}

/**
 * Purchase invoices + supplier payments.
 *
 * Saving a purchase is one operation: stock is received FIRST and the
 * invoice is stored only if that succeeds, so the two can never disagree.
 * The demo history (mockPurchases) is already part of the opening stock,
 * so it is not received again.
 */
type PurchaseState = {
  purchases: Purchase[];
  /** Returns how many packs were added to inventory. Throws on invalid data. */
  addPurchase: (purchase: Purchase) => number;
  recordPayment: (id: string, amountPaise: Paise) => void;
};

export const usePurchaseStore = create<PurchaseState>()((set, get) => ({
  purchases: mockPurchases,

  addPurchase: (purchase) => {
    const { purchases } = get();

    // Defence in depth — the form validates this too
    if (purchases.some((p) => p.id === purchase.id)) {
      throw new PurchaseError("This purchase is already saved");
    }
    const invoice = purchase.invoiceNo.toUpperCase();
    if (
      purchases.some(
        (p) =>
          p.supplierId === purchase.supplierId &&
          p.invoiceNo.toUpperCase() === invoice,
      )
    ) {
      throw new PurchaseError(
        `Invoice ${purchase.invoiceNo} is already entered for this supplier`,
      );
    }

    // 1) Stock first (throws StockError and stops here if anything is wrong)
    const packs = useInventoryStore
      .getState()
      .receive(purchaseToStockReceipt(purchase));

    // 2) Then the invoice
    set({ purchases: [purchase, ...purchases] });
    return packs;
  },

  recordPayment: (id, amountPaise) => {
    if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
      throw new PurchaseError("Enter a valid amount");
    }
    const target = get().purchases.find((p) => p.id === id);
    if (!target) throw new PurchaseError("Purchase not found");
    if (amountPaise > getDuePaise(target)) {
      throw new PurchaseError("Amount is more than the balance");
    }

    set((s) => ({
      purchases: s.purchases.map((p) =>
        p.id === id ? { ...p, paidPaise: p.paidPaise + amountPaise } : p,
      ),
    }));
  },
}));
