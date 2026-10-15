import { upsertById, type ShopPatch } from "@medicare/domain/shop/patch";
import { keptOnCounter } from "@medicare/domain/shop/history";
import { useSalesStore } from "@/features/billing/store/useSalesStore";
import { useCustomerStore } from "@/features/customers/store/useCustomerStore";
import { useInventoryStore } from "@/features/inventory/store/useInventoryStore";
import { usePurchaseStore } from "@/features/purchases/store/usePurchaseStore";

/**
 * Merge what one saved operation changed into the screens' data — used for
 * this counter's own saves AND for saves announced from other counters.
 * Safe to apply twice.
 */
export function applyShopPatch(p: ShopPatch) {
  if (p.batches || p.movements || p.batchesRemoved?.length) {
    const gone = new Set(p.batchesRemoved ?? []);
    useInventoryStore.setState((s) => ({
      batches: upsertById(s.batches, p.batches).filter((b) => !gone.has(b.id)),
      movements: upsertById(
        s.movements,
        p.movements?.filter(keptOnCounter),
      ).filter((m) => !gone.has(m.batchId)),
    }));
  }
  if (p.purchases || p.purchaseReturns || p.purchasesRemoved?.length) {
    const gone = new Set(p.purchasesRemoved ?? []);
    usePurchaseStore.setState((s) => ({
      purchases: upsertById(s.purchases, p.purchases).filter(
        (x) => !gone.has(x.id),
      ),
      returns: upsertById(s.returns, p.purchaseReturns),
    }));
  }
  if (p.sales || p.saleReturns || p.held || p.heldRemoved) {
    const gone = new Set(p.heldRemoved ?? []);
    useSalesStore.setState((s) => ({
      sales: upsertById(s.sales, p.sales),
      saleReturns: upsertById(s.saleReturns, p.saleReturns),
      held: upsertById(s.held, p.held).filter((h) => !gone.has(h.id)),
    }));
  }
  if (p.customers || p.customerPayments || p.customersRemoved?.length) {
    const gone = new Set(p.customersRemoved ?? []);
    useCustomerStore.setState((s) => ({
      customers: upsertById(s.customers, p.customers).filter(
        (c) => !gone.has(c.id),
      ),
      payments: upsertById(s.payments, p.customerPayments),
    }));
  }
}
