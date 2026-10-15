import { describe, expect, it } from "vitest";
import {
  CUSTOMER_SAMPLE_CSV,
  SUPPLIER_SAMPLE_CSV,
  parseBalance,
  parseCustomerCsv,
  parseSupplierCsv,
} from "./csv";

describe("bringing customers and suppliers over from other software", () => {
  it("balances as other software writes them", () => {
    expect(parseBalance("1,250.50 Dr")).toBe(125050);
    expect(parseBalance("₹ 300 Cr")).toBe(-30000);
    expect(parseBalance("")).toBe(0);
    expect(parseBalance("abc")).toBeNull();
  });

  it("a Marg-style party list: loose column names, Dr/Cr, totals skipped", () => {
    const csv = [
      "Party Name,Mobile No.,Area,Cl. Bal",
      'Ramesh Patil,+91 98123 45670,Thane,"1,250.00 Dr"',
      "Sunita Joshi,12345,Naupada,300 Cr",
      ",,,",
      "Total,,,950.00",
    ].join("\n");
    const r = parseCustomerCsv(csv);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toMatchObject({
      name: "Ramesh Patil",
      phone: "9812345670",
      address: "Thane",
      openingBalancePaise: 125000,
    });
    // bad mobile kept in notes, Cr not carried over (reported)
    expect(r.rows[1]).toMatchObject({ phone: "", openingBalancePaise: 0 });
    expect(r.problems).toEqual([
      expect.objectContaining({ row: 3, error: expect.stringMatching(/Cr/) }),
    ]);
    expect(r.openingPaise).toBe(125000);
  });

  it("our sample files read back", () => {
    expect(parseCustomerCsv(CUSTOMER_SAMPLE_CSV).rows).toHaveLength(2);
    expect(parseSupplierCsv(SUPPLIER_SAMPLE_CSV).rows[0]).toMatchObject({
      gstin: "27AACFO5678L1ZN",
      creditDays: 30,
      openingDuePaise: 4_850_000,
    });
  });

  it("a file without a name column is refused", () => {
    expect(() => parseSupplierCsv("a,b\n1,2")).toThrow(/Name/);
  });
});
