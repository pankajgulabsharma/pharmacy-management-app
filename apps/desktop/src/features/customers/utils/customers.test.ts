import { beforeEach, describe, expect, it } from "vitest";
import { useSalesStore } from "@/features/billing/store/useSalesStore";
import { useInventoryStore } from "@/features/inventory/store/useInventoryStore";
import { useMedicineStore } from "@/features/medicines/store/useMedicineStore";
import { EMPTY_PAYMENT } from "@medicare/domain/billing/types";
import {
  sellableBatches,
  stockLimits,
} from "@medicare/domain/billing/allocate";
import { owedBy, useCustomerStore } from "../store/useCustomerStore";
import { customerLedger, customerSummaries } from "@medicare/domain/customers/ledger";
import { validatePaymentIn } from "@medicare/domain/customers/validation";
import { searchCustomers } from "@medicare/domain/customers/search";

const init = {
  sales: useSalesStore.getState(),
  inv: useInventoryStore.getState(),
  cust: useCustomerStore.getState(),
};
beforeEach(() => {
  useSalesStore.setState(init.sales, true);
  useInventoryStore.setState(init.inv, true);
  useCustomerStore.setState(init.cust, true);
});

const cust = () => useCustomerStore.getState();

function udhaarSale(customerId: string | null) {
  const now = new Date();
  const m = useMedicineStore
    .getState()
    .medicines.find(
      (x) =>
        x.status === "active" &&
        x.unit === "STP" &&
        stockLimits(
          sellableBatches(useInventoryStore.getState().batches, x.id, now),
          x,
          0,
        ).maxStrip > 2,
    )!;
  return useSalesStore.getState().completeSale({
    cart: [
      {
        lineId: "c",
        medicineId: m.id,
        qtyStrip: 1,
        qtyLoose: 0,
        discountPercent: 0,
      },
    ],
    customerName: "typed name is ignored",
    customerId,
    doctor: "",
    counter: "Counter 1",
    payment: { ...EMPTY_PAYMENT, method: "udhaar" },
  });
}

describe("udhaar ledger", () => {
  it("demo data: nobody owes a negative amount and every udhaar bill has an account", () => {
    const { sales, saleReturns } = useSalesStore.getState();
    for (const s of sales)
      if (s.status === "udhaar") expect(s.customerId).toBeTruthy();
    const sums = customerSummaries(
      cust().customers,
      sales,
      saleReturns,
      cust().payments,
    );
    for (const v of sums.values())
      expect(v.balancePaise).toBeGreaterThanOrEqual(0);
  });

  it("statement running balance ends at the summary balance", () => {
    const { sales, saleReturns } = useSalesStore.getState();
    const c = cust().customers[0];
    const entries = customerLedger(c.id, sales, saleReturns, cust().payments);
    const sum = customerSummaries([c], sales, saleReturns, cust().payments).get(
      c.id,
    )!;
    expect(entries.at(-1)?.balancePaise ?? 0).toBe(sum.balancePaise);
  });

  it("an udhaar bill goes on the account (with the account's name)", () => {
    const c = cust().customers.find((x) => x.creditLimitPaise === 0)!;
    const before = owedBy(c.id);
    const sale = udhaarSale(c.id);
    expect(sale.customerName).toBe(c.name);
    expect(owedBy(c.id)).toBe(before + sale.totals.netPaise);
  });

  it("udhaar without an account is refused", () => {
    expect(() => udhaarSale(null)).toThrow(/account/);
  });

  it("refuses udhaar beyond the credit limit, without touching stock", () => {
    const c = cust().customers.find((x) => x.creditLimitPaise > 0)!;
    useCustomerStore.setState({
      customers: cust().customers.map((x) =>
        x.id === c.id ? { ...x, creditLimitPaise: owedBy(c.id) + 1 } : x,
      ),
    });
    const batches = useInventoryStore.getState().batches;
    expect(() => udhaarSale(c.id)).toThrow(/limit/);
    expect(useInventoryStore.getState().batches).toBe(batches);
  });
});

describe("payments received", () => {
  it("reduces what the customer owes, with a receipt number", () => {
    const c = cust().customers.find((x) => owedBy(x.id) > 10_000)!;
    const before = owedBy(c.id);
    const p = cust().recordPayment({
      customerId: c.id,
      amount: "100",
      method: "cash",
      reference: "",
      note: "",
    });
    expect(p.receiptNo).toMatch(/^RC-\d{4}$/);
    expect(owedBy(c.id)).toBe(before - 10_000);
  });

  it("never takes more than owed, or nonsense amounts", () => {
    const base = {
      customerId: "x",
      method: "cash" as const,
      reference: "",
      note: "",
    };
    expect(validatePaymentIn({ ...base, amount: "501" }, 50_000)).toMatchObject(
      { ok: false },
    );
    expect(validatePaymentIn({ ...base, amount: "-5" }, 50_000)).toMatchObject({
      ok: false,
    });
    expect(validatePaymentIn({ ...base, amount: "abc" }, 50_000)).toMatchObject(
      { ok: false },
    );
    expect(validatePaymentIn({ ...base, amount: "10" }, 0)).toMatchObject({
      ok: false,
    });
    expect(validatePaymentIn({ ...base, amount: "499.50" }, 50_000)).toEqual({
      ok: true,
      amountPaise: 49_950,
    });
  });

  it("rejects duplicate phone numbers", () => {
    const c = cust().customers[0];
    expect(() =>
      cust().addCustomer({
        name: "Someone",
        phone: c.phone,
        address: "",
        creditLimitPaise: 0,
        notes: "",
        status: "active",
      }),
    ).toThrow(/number/);
  });
});

describe("customer search ranking", () => {
  const list = useCustomerStore.getState().customers;
  it("puts the name that STARTS with the text first (never the wrong account)", () => {
    expect(searchCustomers(list, "neha")[0].name).toBe("Neha Gupta"); // not Sneha Patel
    expect(searchCustomers(list, "neha").map((c) => c.name)).toContain(
      "Sneha Patel",
    );
  });
  it("finds by surname and by mobile", () => {
    expect(searchCustomers(list, "gupta")[0].name).toBe("Neha Gupta");
    expect(searchCustomers(list, "9819087654")[0].name).toBe("Neha Gupta");
  });
});
