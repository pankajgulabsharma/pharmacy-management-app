import { describe, expect, it } from "vitest";
import {
  demoCustomerPayments,
  demoCustomers,
  demoSaleReturns,
  demoSales,
} from "@medicare/demo/seed";
import { cleanCustomerInput } from "@medicare/domain/customers/clean";
import {
  customerLedger,
  customerSummaries,
} from "@medicare/domain/customers/ledger";
import { searchCustomers } from "@medicare/domain/customers/search";
import { validatePaymentIn } from "@medicare/domain/customers/validation";

// Saving (udhaar bills, limits, payments) is tested on the server: apps/server/src/routes/shop.test.ts

describe("udhaar ledger (demo data)", () => {
  it("nobody owes a negative amount and every udhaar bill has an account", () => {
    for (const s of demoSales)
      if (s.status === "udhaar") expect(s.customerId).toBeTruthy();
    const sums = customerSummaries(
      demoCustomers,
      demoSales,
      demoSaleReturns,
      demoCustomerPayments,
    );
    for (const v of sums.values())
      expect(v.balancePaise).toBeGreaterThanOrEqual(0);
  });

  it("statement running balance ends at the summary balance", () => {
    const c = demoCustomers[0];
    const entries = customerLedger(
      c.id,
      demoSales,
      demoSaleReturns,
      demoCustomerPayments,
    );
    const sum = customerSummaries(
      [c],
      demoSales,
      demoSaleReturns,
      demoCustomerPayments,
    ).get(c.id)!;
    expect(entries.at(-1)?.balancePaise ?? 0).toBe(sum.balancePaise);
  });
});

describe("customer rules", () => {
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

  it("one account per mobile number", () => {
    const input = {
      name: "Someone",
      phone: demoCustomers[0].phone,
      address: "",
      creditLimitPaise: 0,
      notes: "",
      status: "active" as const,
    };
    expect(() => cleanCustomerInput(input, demoCustomers)).toThrow(/number/);
  });
});

describe("customer search ranking", () => {
  it("puts the name that STARTS with the text first (never the wrong account)", () => {
    expect(searchCustomers(demoCustomers, "neha")[0].name).toBe("Neha Gupta"); // not Sneha Patel
    expect(searchCustomers(demoCustomers, "neha").map((c) => c.name)).toContain(
      "Sneha Patel",
    );
  });
  it("finds by surname and by mobile", () => {
    expect(searchCustomers(demoCustomers, "gupta")[0].name).toBe("Neha Gupta");
    expect(searchCustomers(demoCustomers, "9819087654")[0].name).toBe(
      "Neha Gupta",
    );
  });
});
