import { describe, expect, it } from "vitest";
import { mockMedicines } from "@medicare/demo/data/mockMedicines";
import { mockSuppliers } from "@medicare/demo/data/mockSuppliers";
import { demoCustomers, demoPurchases, demoSales } from "@medicare/demo/seed";
import { globalSearch } from "./globalSearch";

const all = {
  medicines: mockMedicines,
  sales: demoSales,
  customers: demoCustomers,
  suppliers: mockSuppliers,
  purchases: demoPurchases,
};

describe("header search", () => {
  it("a name match comes before a salt match", () => {
    const meds = globalSearch("paracetamol", all).filter(
      (h) => h.group === "Medicines",
    );
    expect(meds[0].title).toMatch(/^Paracetamol/);
    // …and medicines that only CONTAIN paracetamol (salt) still show
    expect(meds.some((h) => !/Paracetamol/.test(h.title))).toBe(true);
  });

  it("finds a medicine by name or salt, words in any order", () => {
    const hits = globalSearch("650 paracetamol", all);
    expect(hits[0]).toMatchObject({ group: "Medicines" });
    expect(hits[0].title).toMatch(/Paracetamol/);
    expect(hits[0].to).toMatch(/^\/medicines\?q=/);
  });

  it("finds a bill by number and opens it (no page change)", () => {
    const bill = demoSales[0];
    const hit = globalSearch(bill.billNo, all).find((h) => h.group === "Bills");
    expect(hit).toMatchObject({ saleId: bill.id });
  });

  it("finds customers by mobile number", () => {
    const c = demoCustomers.find((x) => x.phone)!;
    expect(globalSearch(c.phone, all).some((h) => h.key === `c:${c.id}`)).toBe(
      true,
    );
  });

  it("roles without Suppliers/Purchases never see them", () => {
    const s = mockSuppliers[0];
    const cashier = { ...all, suppliers: undefined, purchases: undefined };
    expect(globalSearch(s.name, all).some((h) => h.group === "Suppliers")).toBe(
      true,
    );
    expect(
      globalSearch(s.name, cashier).some(
        (h) => h.group === "Suppliers" || h.group === "Purchases",
      ),
    ).toBe(false);
  });

  it("needs 2+ letters and caps each group", () => {
    expect(globalSearch("a", all)).toEqual([]);
    const bills = globalSearch("inv", all).filter((h) => h.group === "Bills");
    expect(bills.length).toBe(5);
  });
});
