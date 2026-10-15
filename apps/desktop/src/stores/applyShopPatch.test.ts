import { describe, expect, it } from "vitest";
import {
  demoCustomers,
  demoInventory,
  demoPurchases,
} from "@medicare/demo/seed";
import { useInventoryStore } from "@/features/inventory/store/useInventoryStore";
import { useCustomerStore } from "@/features/customers/store/useCustomerStore";
import { usePurchaseStore } from "@/features/purchases/store/usePurchaseStore";
import { applyShopPatch } from "./applyShopPatch";

describe("live patches can remove records (an undone import)", () => {
  it("drops removed batches with their movements, customers and old dues", () => {
    const [b1, b2] = demoInventory.batches;
    useInventoryStore.setState({
      batches: [b1, b2],
      movements: demoInventory.movements.filter(
        (m) => m.batchId === b1.id || m.batchId === b2.id,
      ),
    });
    const [c1, c2] = demoCustomers;
    useCustomerStore.setState({ customers: [c1, c2] });
    const [p1, p2] = demoPurchases;
    usePurchaseStore.setState({ purchases: [p1, p2] });

    applyShopPatch({
      batchesRemoved: [b1.id],
      customersRemoved: [c2.id],
      purchasesRemoved: [p1.id],
    });

    const inv = useInventoryStore.getState();
    expect(inv.batches.map((b) => b.id)).toEqual([b2.id]);
    expect(inv.movements.some((m) => m.batchId === b1.id)).toBe(false);
    expect(useCustomerStore.getState().customers.map((c) => c.id)).toEqual([
      c1.id,
    ]);
    expect(usePurchaseStore.getState().purchases.map((p) => p.id)).toEqual([
      p2.id,
    ]);
  });
});
