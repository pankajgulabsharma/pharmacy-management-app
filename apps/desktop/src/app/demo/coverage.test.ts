import { describe, expect, it } from "vitest";
import { mockMedicines } from "@medicare/demo/data/mockMedicines";
import {
  demoCustomerPayments as payments,
  demoCustomers as customers,
  demoPurchases,
  demoSaleReturns as saleReturns,
  demoSales as sales,
} from "@medicare/demo/seed";
import { customerSummaries } from "@medicare/domain/customers/ledger";
import { customerStatus } from "@medicare/domain/customers/status";
import { getPaymentStatus } from "@medicare/domain/purchases/calc";

/** The demo must show something under EVERY filter chip — an empty chip looks broken */
describe("demo data covers every filter", () => {
  it("customers: due, over limit, clear, inactive", () => {
    const sums = customerSummaries(customers, sales, saleReturns, payments);
    const seen = new Set(
      customers.map((c) => customerStatus(c, sums.get(c.id)!)),
    );
    expect([...seen].sort()).toEqual(["clear", "due", "inactive", "over"]);
  });

  it("purchases: due, partial, overdue, paid, cancelled", () => {
    const today = new Date();
    const seen = new Set(demoPurchases.map((p) => getPaymentStatus(p, today)));
    expect([...seen].sort()).toEqual([
      "cancelled",
      "due",
      "overdue",
      "paid",
      "partial",
    ]);
  });

  it("medicines: at least one inactive", () => {
    expect(mockMedicines.some((m) => m.status === "inactive")).toBe(true);
  });
});
