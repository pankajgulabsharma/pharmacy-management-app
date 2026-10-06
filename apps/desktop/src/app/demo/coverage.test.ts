import { describe, expect, it } from "vitest";
import { useCustomerStore } from "@/features/customers/store/useCustomerStore";
import { useSalesStore } from "@/features/billing/store/useSalesStore";
import { customerSummaries } from "@/features/customers/utils/ledger";
import { customerStatus } from "@/features/customers/utils/status";
import { usePurchaseStore } from "@/features/purchases/store/usePurchaseStore";
import { getPaymentStatus } from "@/features/purchases/utils/calc";
import { useMedicineStore } from "@/features/medicines/store/useMedicineStore";

/** The demo must show something under EVERY filter chip — an empty chip looks broken */
describe("demo data covers every filter", () => {
  it("customers: due, over limit, clear, inactive", () => {
    const { customers, payments } = useCustomerStore.getState();
    const { sales, saleReturns } = useSalesStore.getState();
    const sums = customerSummaries(customers, sales, saleReturns, payments);
    const seen = new Set(
      customers.map((c) => customerStatus(c, sums.get(c.id)!)),
    );
    expect([...seen].sort()).toEqual(["clear", "due", "inactive", "over"]);
  });

  it("purchases: due, partial, overdue, paid, cancelled", () => {
    const today = new Date();
    const seen = new Set(
      usePurchaseStore
        .getState()
        .purchases.map((p) => getPaymentStatus(p, today)),
    );
    expect([...seen].sort()).toEqual([
      "cancelled",
      "due",
      "overdue",
      "paid",
      "partial",
    ]);
  });

  it("medicines: at least one inactive", () => {
    expect(
      useMedicineStore
        .getState()
        .medicines.some((m) => m.status === "inactive"),
    ).toBe(true);
  });
});
