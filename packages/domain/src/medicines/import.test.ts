import { describe, expect, it } from "vitest";
import { toExpiryMMYY } from "../lib/expiry";
import { parseCsv } from "../lib/csv";
import { buildSampleCsv, parseMedicineCsv } from "./csv";
import { scheduleRegister, scheduleRule } from "./schedule";
import type { Sale } from "../billing/types";

describe("reading files from other software", () => {
  it("understands every common expiry style", () => {
    for (const [raw, want] of [
      ["12/26", "12/26"],
      ["12-2026", "12/26"],
      ["Dec-26", "12/26"],
      ["DEC 2026", "12/26"],
      ["2026-12-31", "12/26"],
      ["31/12/2026", "12/26"],
      ["8/27", "08/27"],
      ["13/26", ""],
      ["soon", ""],
    ])
      expect(toExpiryMMYY(raw), raw).toBe(want);
  });

  it("handles quotes, commas inside quotes and tab-separated files", () => {
    expect(parseCsv('a,b\n"x, y",2')).toEqual([
      ["a", "b"],
      ["x, y", "2"],
    ]);
    expect(parseCsv("a\tb\nx\t2")).toEqual([
      ["a", "b"],
      ["x", "2"],
    ]);
  });

  it("a Marg-style stock export → medicines + opening batches", () => {
    const marg = [
      "Item Name,Company,Pack,Batch No,Exp Date,Cl. Stock,MRP,P.Rate,GST%",
      "AZEE 500 TAB,Cipla,1x3,AZ771,Jun-27,12,120.50,80,12",
      "AZEE 500 TAB,Cipla,1x3,AZ802,Dec-27,5,120.50,82,12",
      "BENADRYL SYRUP 100ML,J&J,100ML,BN11,08/2026,0,110,70,12",
    ].join("\n");
    const r = parseMedicineCsv(marg);
    expect(r.every((x) => x.ok)).toBe(true);
    const [a, b, c] = r as Extract<(typeof r)[number], { ok: true }>[];
    expect(a.medicine).toMatchObject({
      name: "AZEE 500 TAB",
      brand: "Cipla",
      category: "tablet_capsule",
      unit: "STP",
      unitsPerStrip: 3,
      mrp: 120.5,
      salePrice: 120.5,
      gstPercent: 12,
    });
    expect(a.opening).toEqual({
      batchNo: "AZ771",
      expiry: "06/27",
      qty: 12,
      mrp: 120.5,
      purchasePrice: 80,
    });
    expect(b.opening?.batchNo).toBe("AZ802");
    expect(c.medicine.category).toBe("syrup_suspension");
    expect(c.opening).toBeUndefined(); // 0 in stock → medicine only
  });

  it("our sample file reads back cleanly", () => {
    const r = parseMedicineCsv(buildSampleCsv());
    expect(r.every((x) => x.ok)).toBe(true);
    expect(r[1]).toMatchObject({ ok: true, medicine: { schedule: "H" } });
  });

  it("explains bad rows instead of guessing", () => {
    const r = parseMedicineCsv(
      "name,mrp,qty,expiry\nX Tab,,5,12/27\nY Tab,10,5,never",
    );
    expect(r[0]).toMatchObject({ ok: false, row: 2, message: /MRP/ });
    expect(r[1]).toMatchObject({ ok: false, row: 3, message: /expiry/ });
    expect(parseMedicineCsv("foo,bar\n1,2")[0]).toMatchObject({ ok: false });
  });
});

describe("Schedule H / H1 / X", () => {
  const line = (
    schedule: "" | "H" | "H1" | "X",
    medicineName = "Taxim 1g",
  ) => ({
    medicineName,
    schedule,
  });

  it("H needs the doctor; H1/X also need the patient's name", () => {
    expect(scheduleRule([line("")], "Walk-in customer", "")).toBeNull();
    expect(scheduleRule([line("H")], "Walk-in customer", "")).toMatch(/doctor/);
    expect(scheduleRule([line("H")], "Walk-in customer", "Dr. A")).toBeNull();
    expect(scheduleRule([line("H1")], "Walk-in customer", "Dr. A")).toMatch(
      /patient/,
    );
    expect(scheduleRule([line("X")], "Ravi", "")).toMatch(/doctor/);
    expect(scheduleRule([line("H1")], "Ravi", "Dr. A")).toBeNull();
  });

  it("the register lists every H1 / X supply in the period, oldest first", () => {
    const sale = (id: string, at: string, schedule?: "H" | "H1") =>
      ({
        id,
        billNo: id,
        createdAt: at,
        customerName: "Ravi",
        doctor: "Dr. A",
        lines: [
          {
            medicineName: "Taxim",
            schedule,
            unit: "BTL",
            qtyStrip: 1,
            qtyLoose: 0,
            allocations: [{ batchNo: "T1", expiry: "01/28" }],
          },
        ],
      }) as unknown as Sale;
    const rows = scheduleRegister(
      [
        sale("INV-3", "2026-10-03T10:00:00Z", "H1"),
        sale("INV-1", "2026-10-01T10:00:00Z", "H1"),
        sale("INV-2", "2026-10-02T10:00:00Z", "H"),
        sale("INV-9", "2026-11-01T10:00:00Z", "H1"),
      ],
      {
        from: new Date("2026-10-01T00:00:00"),
        to: new Date("2026-10-31T23:59:59"),
      },
    );
    expect(rows.map((r) => r.billNo)).toEqual(["INV-1", "INV-3"]);
    expect(rows[0]).toMatchObject({
      patient: "Ravi",
      doctor: "Dr. A",
      batches: "T1 (01/28)",
      qty: "1 BTL",
    });
  });
});
