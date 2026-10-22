import { useMemo } from "react";
import {
  expiryItems,
  groupBySupplier,
} from "@medicare/domain/purchases/expiryReturns";
import { useInventoryStore } from "@/features/inventory/store/useInventoryStore";
import { useMedicineStore } from "@/features/medicines/store/useMedicineStore";
import { usePurchaseStore } from "../store/usePurchaseStore";

/** Expired / short-dated stock, grouped by the supplier it came from */
export function useExpiryItems(nearDays: number) {
  const batches = useInventoryStore((s) => s.batches);
  const medicines = useMedicineStore((s) => s.medicines);
  const purchases = usePurchaseStore((s) => s.purchases);
  const returns = usePurchaseStore((s) => s.returns);
  return useMemo(() => {
    const items = expiryItems(batches, medicines, purchases, returns, {
      nearDays,
    });
    return { items, ...groupBySupplier(items) };
  }, [batches, medicines, purchases, returns, nearDays]);
}
