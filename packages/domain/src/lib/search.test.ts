import { describe, expect, it } from "vitest";
import { medicineSearch } from "../medicines/search";
import type { Medicine } from "../medicines/types";
import { createSearch } from "./search";

const med = (name: string, salt: string, barcode = ""): Medicine => ({
  id: name,
  name,
  salt,
  brand: "Micro Labs",
  category: "tablet_capsule",
  hsn: "30049099",
  barcode,
  rack: "A1",
  unit: "STP",
  unitsPerStrip: 10,
  allowLoose: true,
  mrp: 30,
  salePrice: 30,
  minStock: 5,
  gstPercent: 5,
  schedule: "",
  status: "active",
});
const mockMedicines = [
  med("Calpol Suspension 60ml", "Paracetamol"),
  med("Dolo 650 Tablet", "Paracetamol", "8901030005105"),
  med("Paracetamol 500mg Tablet (Box)", "Paracetamol"),
  med("Paracetamol 650mg Tablet", "Paracetamol"),
  med("Azithral 500", "Azithromycin"),
];

const names = (q: string) =>
  medicineSearch.filter(mockMedicines, q).map((m) => m.name);

describe("one search for the whole app", () => {
  it("name matches first, then same-salt medicines (substitutes)", () => {
    const r = names("paracetamol");
    expect(r[0]).toMatch(/^Paracetamol/);
    const firstOther = r.findIndex((n) => !/^Paracetamol/.test(n));
    expect(firstOther).toBeGreaterThan(0);
    expect(r.slice(firstOther).every((n) => !/^Paracetamol/.test(n))).toBe(
      true,
    );
    expect(r).toContain("Dolo 650 Tablet"); // salt: Paracetamol
  });

  it("every word must match, any order, word starts, plurals ok", () => {
    expect(names("paracetamol 650 tablet")[0]).toBe("Paracetamol 650mg Tablet");
    expect(names("paracetamol 650 tablet")).not.toContain(
      "Paracetamol 500mg Tablet (Box)",
    );
    expect(names("650 para")[0]).toBe("Paracetamol 650mg Tablet");
    expect(names("dolo tablets")).toEqual(["Dolo 650 Tablet"]);
    expect(names("650mg")).toContain("Paracetamol 650mg Tablet");
  });

  it("no noise from the middle of words or codes", () => {
    // "ol" is inside Dolo / Paracetamol — not a word start
    expect(names("ol")).toEqual([]);
    // a single digit no longer matches every barcode
    expect(names("dolo 5")).toEqual([]);
  });

  it("codes match from the middle with 3+ characters", () => {
    const s = createSearch((x: { n: string; code: string }) => ({
      name: x.n,
      codes: [x.code],
    }));
    const list = [
      { n: "Neha Gupta", code: "98190 87654" },
      { n: "Bill", code: "INV-0042" },
    ];
    expect(s.filter(list, "9819087654")[0].n).toBe("Neha Gupta");
    expect(s.filter(list, "87654")[0].n).toBe("Neha Gupta");
    expect(s.filter(list, "0042")[0].n).toBe("Bill");
    expect(s.filter(list, "inv-0042")[0].n).toBe("Bill");
    expect(s.filter(list, "42")).toEqual([]);
  });

  it("Hindi names work too", () => {
    const s = createSearch((x: { n: string }) => ({ name: x.n }));
    expect(s.filter([{ n: "राम कुमार" }, { n: "Ravi" }], "कुमार")).toEqual([
      { n: "राम कुमार" },
    ]);
  });

  it("limit cuts after ranking — the best match is never lost", () => {
    const list = [
      ...Array.from({ length: 60 }, (_, i) => ({ n: `Zinc ${i}`, s: "para" })),
      { n: "Paracip", s: "" },
    ];
    const s = createSearch((x: { n: string; s: string }) => ({
      name: x.n,
      text: [x.s],
    }));
    expect(s.filter(list, "para", { limit: 5 })[0].n).toBe("Paracip");
  });
});
