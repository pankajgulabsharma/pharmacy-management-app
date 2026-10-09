import { describe, expect, it } from "vitest";
import type { Sale, SaleReturn } from "../billing/types";
import type { Purchase } from "../purchases/types";
import { crc32, zipFiles } from "../lib/zip";
import { gstDate, gstr1, gstr1Files } from "./gstr1";
import { matchGstr2b, parseGstr2b } from "./gstr2b";

const SHOP = "27AABCM1234F1ZX";
const range = {
  from: new Date(2026, 9, 1),
  to: new Date(2026, 9, 31, 23, 59, 59, 999),
};

/** A bill with one 5% line of ₹105 (₹100 + ₹5 GST) and one 12% line of ₹112 */
function sale(id: string, over: Partial<Sale> = {}): Sale {
  const line = (n: string, rate: 5 | 12, amount: number, taxable: number) => ({
    id: `${id}-${n}`,
    medicineId: n,
    medicineName: n,
    brand: "",
    hsn: "30049099",
    unit: "STP" as const,
    unitsPerStrip: 10,
    gstPercent: rate,
    discountPercent: 0,
    qtyStrip: 1,
    qtyLoose: 5,
    allocations: [],
    grossPaise: amount,
    discountPaise: 0,
    amountPaise: amount,
    taxablePaise: taxable,
    gstPaise: amount - taxable,
  });
  return {
    id,
    billNo: `INV/26-27/${id}`,
    createdAt: new Date(2026, 9, 10, 11).toISOString(),
    customerName: "Walk-in customer",
    doctor: "",
    counter: "",
    lines: [line("a", 5, 10_500, 10_000), line("b", 12, 11_200, 10_000)],
    totals: {
      itemCount: 2,
      grossPaise: 21_700,
      discountPaise: 0,
      taxablePaise: 20_000,
      cgstPaise: 850,
      sgstPaise: 850,
      gstPaise: 1_700,
      roundOffPaise: 0,
      netPaise: 21_700,
    },
    payment: {
      method: "cash",
      receivedPaise: 21_700,
      changePaise: 0,
      split: null,
      reference: "",
    },
    status: "paid",
    returnedPaise: 0,
    ...over,
  };
}

describe("GSTR-1 files for the GST Offline Tool", () => {
  const retail = sale("0001");
  const clinic = sale("0002", {
    customerName: "City Clinic",
    customerGstin: "27AAPFU0939F1ZV",
  });
  const otherState = sale("0003", {
    customerName: "Goa Hospital",
    customerGstin: "30AAPFU0939F1Z9",
    interstate: true,
  });
  const ret: SaleReturn = {
    id: "r1",
    returnNo: "SR/26-27/0001",
    saleId: clinic.id,
    billNo: clinic.billNo,
    customerName: clinic.customerName,
    createdAt: new Date(2026, 9, 12).toISOString(),
    reason: "Wrong medicine",
    refundMode: "cash",
    notes: "",
    lines: [
      {
        id: "rl",
        saleLineId: clinic.lines[0].id,
        medicineId: "a",
        medicineName: "a",
        unit: "STP",
        unitsPerStrip: 10,
        qtyStrip: 1,
        qtyLoose: 0,
        amountPaise: 10_500,
        batches: [],
      },
    ],
    roundOffPaise: 0,
    refundPaise: 10_500,
  };
  const r = gstr1([retail, clinic, otherState], [ret], range, SHOP);

  it("B2B bills one row per rate; other state is IGST", () => {
    expect(r.b2b).toHaveLength(4);
    const goa = r.b2b.filter((x) => x.gstin.startsWith("30"));
    expect(goa.every((x) => x.igst > 0 && x.cgst === 0)).toBe(true);
    const local = r.b2b.find((x) => x.gstin.startsWith("27") && x.rate === 5)!;
    expect(local).toMatchObject({
      taxable: 10_000,
      cgst: 250,
      sgst: 250,
      igst: 0,
    });
  });

  it("retail bills go to b2cs per rate; B2B returns become credit notes", () => {
    expect(r.b2cs.map((x) => [x.rate, x.taxable])).toEqual([
      [5, 10_000],
      [12, 10_000],
    ]);
    expect(r.cdnr).toEqual([
      expect.objectContaining({
        noteNo: "SR/26-27/0001",
        gstin: clinic.customerGstin,
        rate: 5,
        taxable: 10_000,
      }),
    ]);
  });

  it("HSN summary split into B2B and B2C tabs, net of returns", () => {
    const b2c = r.hsnB2c.find((x) => x.rate === 5)!;
    expect(b2c).toMatchObject({ hsn: "30049099", uqc: "PAC-PACKS", qty: 1.5 });
    // clinic's 5% line was returned (1 of 1.5 packs), Goa's remains
    const b2b5 = r.hsnB2b.find((x) => x.rate === 5)!;
    expect(b2b5.qty).toBeCloseTo(2);
    expect(b2b5.taxable).toBe(10_000);
  });

  it("documents issued: first and last number", () => {
    expect(r.docs[0]).toMatchObject({
      from: "INV/26-27/0001",
      to: "INV/26-27/0003",
      total: 3,
    });
  });

  it("CSV headers exactly as the GST tool expects (no BOM, dd-Mmm-yyyy)", () => {
    const files = gstr1Files(r);
    expect(files.map((f) => f.name)).toEqual([
      "b2b.csv",
      "b2cs.csv",
      "cdnr.csv",
      "hsn(b2b).csv",
      "hsn(b2c).csv",
      "docs.csv",
    ]);
    const b2b = files[0].csv;
    expect(
      b2b.startsWith("GSTIN/UIN of Recipient,Receiver Name,Invoice Number"),
    ).toBe(true);
    expect(b2b).toContain("27-Maharashtra");
    expect(b2b).toContain("30-Goa");
    expect(gstDate(new Date(2026, 9, 5).toISOString())).toBe("05-Oct-2026");
    expect(files[1].csv).toContain("OE,27-Maharashtra,,5,100,0,");
  });
});

describe("zip of several files", () => {
  it("is a valid zip (signature, CRC)", () => {
    expect(crc32(new TextEncoder().encode("hello"))).toBe(0x3610a686);
    const z = zipFiles([
      { name: "a.csv", data: "x,y" },
      { name: "b.csv", data: "1,2" },
    ]);
    expect([...z.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const end = z.length - 22;
    expect(new DataView(z.buffer).getUint16(end + 10, true)).toBe(2);
  });
});

describe("GSTR-2B match", () => {
  const json = JSON.stringify({
    data: {
      gstin: SHOP,
      rtnprd: "102026",
      docdata: {
        b2b: [
          {
            ctin: "27AAAAA0000A1Z5",
            trdnm: "Om Sai Medical",
            inv: [
              {
                inum: "OSM/0042",
                dt: "05-10-2026",
                val: 1050,
                itcavl: "Y",
                items: [{ num: 1, rt: 5, txval: 1000, cgst: 25, sgst: 25 }],
              },
              {
                inum: "OSM/0050",
                dt: "08-10-2026",
                val: 525,
                items: [{ rt: 5, txval: 500, cgst: 12.5, sgst: 12.5 }],
              },
            ],
          },
        ],
      },
    },
  });
  const p = (no: string, gst: number, date = "2026-10-05"): Purchase =>
    ({
      id: no,
      status: "active",
      supplierName: "Om Sai Medical",
      supplierGstin: "27AAAAA0000A1Z5",
      invoiceNo: no,
      invoiceDate: date,
      totals: { gstPaise: gst },
    }) as unknown as Purchase;

  it("reads the portal file and matches by GSTIN + invoice number", () => {
    const twoB = parseGstr2b(json);
    expect(twoB.period).toBe("102026");
    expect(twoB.invoices[0]).toMatchObject({
      invoiceNo: "OSM/0042",
      date: "2026-10-05",
      gstPaise: 5_000,
    });
    const rows = matchGstr2b(twoB, [
      p("OSM-42", 5_000), // typed differently → still the same bill
      p("OSM/0061", 900), // not reported by the supplier
      p("OSM/0001", 900, "2026-09-01"), // other month → not checked
    ]);
    const by = (s: string) =>
      rows.filter((r) => r.status === s).map((r) => r.invoiceNo);
    expect(by("matched")).toEqual(["OSM/0042"]);
    expect(by("not_in_books")).toEqual(["OSM/0050"]);
    expect(by("not_in_2b")).toEqual(["OSM/0061"]);
  });

  it("tax that differs is flagged; junk files are refused", () => {
    const rows = matchGstr2b(parseGstr2b(json), [p("OSM/0042", 9_000)]);
    expect(rows[0].status).toBe("tax_differs");
    expect(() => parseGstr2b("{}")).toThrow(/not a GSTR-2B/);
    expect(() => parseGstr2b("hello")).toThrow(/not a GSTR-2B/);
  });
});
