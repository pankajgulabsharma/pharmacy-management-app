import { useMemo } from "react";
import { usePurchaseStore } from "@/features/purchases/store/usePurchaseStore";
import {
  getCreditPaise,
  getDuePaise,
  getPaymentStatus,
} from "@medicare/domain/purchases/calc";
import { useSupplierStore } from "../store/useSupplierStore";
import type { SupplierSummary, SupplierWithSummary } from "@medicare/domain/suppliers/types";

const empty = (): SupplierSummary => ({
  invoiceCount: 0,
  purchasedPaise: 0,
  outstandingPaise: 0,
  overduePaise: 0,
  overdueCount: 0,
  creditPaise: 0,
  returnCount: 0,
  lastPurchaseDate: null,
});

/**
 * Suppliers joined with their money position, computed in one pass over
 * purchases and returns. Re-runs only when one of those lists changes.
 */
export function useSupplierSummaries(today: Date): SupplierWithSummary[] {
  const suppliers = useSupplierStore((s) => s.suppliers);
  const purchases = usePurchaseStore((s) => s.purchases);
  const returns = usePurchaseStore((s) => s.returns);

  return useMemo(() => {
    const map = new Map<string, SupplierSummary>();
    const get = (id: string) => {
      let s = map.get(id);
      if (!s) map.set(id, (s = empty()));
      return s;
    };

    for (const p of purchases) {
      const s = get(p.supplierId);
      s.creditPaise += getCreditPaise(p);
      if (p.status === "cancelled") continue;

      s.invoiceCount++;
      s.purchasedPaise += p.totals.netPaise;
      const due = getDuePaise(p);
      s.outstandingPaise += due;
      if (due > 0 && getPaymentStatus(p, today) === "overdue") {
        s.overduePaise += due;
        s.overdueCount++;
      }
      if (!s.lastPurchaseDate || p.invoiceDate > s.lastPurchaseDate) {
        s.lastPurchaseDate = p.invoiceDate;
      }
    }
    for (const r of returns) get(r.supplierId).returnCount++;

    return suppliers.map((s) => ({ ...s, ...(map.get(s.id) ?? empty()) }));
  }, [suppliers, purchases, returns, today]);
}
