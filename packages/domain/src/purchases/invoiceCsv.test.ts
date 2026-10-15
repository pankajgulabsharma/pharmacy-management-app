import { describe, expect, it } from "vitest";
import type { Medicine } from "../medicines/types";
import { INVOICE_SAMPLE_CSV, fillLine, parseInvoiceCsv } from "./invoiceCsv";

const med = (id: string, name: string, over: Partial<Medicine> = {}) =>
  ({
    id,
    name,
    salt: "",
    strength: "",
    brand: "Brand",
    category: "tablet_capsule",
    hsn: "30049099",
    barcode: "",
    rack: "",
    unit: "STP",
    unitsPerStrip: 10,
    allowLoose: true,
    mrp: 30,
    salePrice: 27,
    minStock: 0,
    gstPercent: 12,
    schedule: "",
    status: "active",
    ...over,
  }) as Medicine;
const mockMedicines = [
  med("m1", "Paracetamol 650mg Tablet", { salt: "Paracetamol" }),
  med("m2", "Dolo 650 Tablet", { barcode: "8901030650011", gstPercent: 12 }),
  med("m3", "Azithromycin 500mg Tablet"),
  med("m4", "Telma 40 Tablet"),
];

describe("distributor invoice file → purchase lines", () => {
  it("reads the sample: header, batch, expiry, qty, free, rate, MRP, disc, GST", () => {
    const r = parseInvoiceCsv(INVOICE_SAMPLE_CSV, mockMedicines);
    expect(r.problems).toEqual([]);
    expect(r.invoiceNo).toBe("AGN/2451");
    expect(r.invoiceDate).toBe("2026-10-15");
    expect(r.lines).toHaveLength(2);
    expect(r.lines[0]).toMatchObject({
      medicineName: "Dolo 650 Tablet",
      batchNo: "DL65099",
      expiry: "08/28",
      qty: "20",
      freeQty: "2",
      rate: "22.5",
      mrp: "30",
      discountPercent: "",
      gstPercent: 5,
    });
    expect(r.lines[1]).toMatchObject({ discountPercent: "2", gstPercent: 12 });
  });

  it("matches by barcode, skips total rows, never guesses a medicine silently", () => {
    const dolo = mockMedicines.find((m) => m.name === "Dolo 650 Tablet")!;
    const csv = [
      "Product Name,Barcode,Batch No,Expiry Date,Quantity,Rate,MRP",
      `DOLO-650 TABS,${dolo.barcode},X1,2028-08-31,5,22,30`,
      "Calpol 650,,C1,Dec-27,3,20,32",
      "Grand Total,,,,8,,",
      "No Qty Med,,Q1,12/27,,10,15",
    ].join("\n");
    const r = parseInvoiceCsv(csv, mockMedicines);
    expect(r.lines.map((l) => [l.medicineId, l.expiry])).toEqual([
      [dolo.id, "08/28"],
    ]);
    expect(r.unmatched).toHaveLength(1);
    expect(r.unmatched[0]).toMatchObject({ row: 3, name: "Calpol 650" });
    expect(r.unmatched[0].values.expiry).toBe("12/27");
    expect(r.problems).toEqual([
      { row: 5, message: "No Qty Med: quantity missing" },
    ]);
    // Accepting a suggestion keeps the file's numbers
    const para = mockMedicines.find((m) => m.id === "m1")!;
    expect(fillLine(para, r.unmatched[0].values)).toMatchObject({
      medicineId: "m1",
      batchNo: "C1",
      qty: "3",
      rate: "20",
      mrp: "32",
    });
  });

  it("suggests the closest medicine for a different spelling", () => {
    const r = parseInvoiceCsv(
      "Item Name,Qty\nTELMA 40MG TAB,5\nZzzz Unknown,1",
      mockMedicines,
    );
    expect(r.unmatched.map((u) => u.suggestion?.name ?? null)).toEqual([
      "Telma 40 Tablet",
      null,
    ]);
  });

  it("says what's missing in a wrong file", () => {
    expect(
      parseInvoiceCsv("a,b\n1,2", mockMedicines).problems[0].message,
    ).toMatch(/item name/);
  });
});
