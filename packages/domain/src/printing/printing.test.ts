import { describe, expect, it } from "vitest";
import type { Sale } from "../billing/types";
import { DEFAULT_SETTINGS } from "../settings/defaults";
import { gstSummary, receiptHtml } from "./receipt";
import { numberInWords, rupeesInWords } from "./words";
import { isValidEan13, labelsHtml, newInStoreBarcode } from "./labels";

const sale = {
  id: "s1",
  billNo: "INV-0815",
  createdAt: "2026-10-08T08:59:00.000Z",
  customerName: "Ramesh <script>alert(1)</script>",
  doctor: "Dr. Iyer",
  counter: "Counter 1",
  billedBy: "Pankaj Sharma",
  status: "paid",
  returnedPaise: 0,
  lines: [
    {
      id: "l1",
      medicineId: "m1",
      medicineName: "Paracetamol 650mg Tablet",
      brand: "Micro Labs",
      hsn: "30049099",
      unit: "STP",
      unitsPerStrip: 10,
      gstPercent: 5,
      discountPercent: 0,
      qtyStrip: 80,
      qtyLoose: 0,
      grossPaise: 336000,
      discountPaise: 0,
      amountPaise: 336000,
      taxablePaise: 320000,
      gstPaise: 16000,
      allocations: [
        {
          batchId: "b1",
          batchNo: "DL24118",
          expiry: "12/26",
          qtyStrip: 79,
          qtyLoose: 0,
          breakStrips: 0,
          ratePaise: 4200,
          mrpPaise: 4800,
          costPaise: 3200,
        },
        {
          batchId: "b2",
          batchNo: "DL25001",
          expiry: "08/27",
          qtyStrip: 1,
          qtyLoose: 0,
          breakStrips: 0,
          ratePaise: 4200,
          mrpPaise: 4800,
          costPaise: 3300,
        },
      ],
    },
  ],
  totals: {
    itemCount: 1,
    grossPaise: 336000,
    discountPaise: 0,
    taxablePaise: 320000,
    cgstPaise: 8000,
    sgstPaise: 8000,
    gstPaise: 16000,
    roundOffPaise: 0,
    netPaise: 336000,
  },
  payment: {
    method: "cash",
    receivedPaise: 340000,
    changePaise: 4000,
    split: null,
    reference: "",
  },
} as unknown as Sale;

const shop = DEFAULT_SETTINGS.shop;

describe("printed bill", () => {
  it("every paper size is a full page with the whole bill (not just the title)", () => {
    for (const format of ["thermal58", "thermal80", "a5", "a4"] as const) {
      const html = receiptHtml({ sale, shop, footer: "Get well soon", format });
      expect(html.startsWith("<!doctype html>")).toBe(true);
      for (const must of [
        "INV-0815",
        "Paracetamol 650mg Tablet",
        "DL24118",
        "DL25001",
        "3,360.00",
        "Pankaj Sharma",
        "Counter 1",
        "Get well soon",
        shop.drugLicense,
      ])
        expect(html, `${format} has ${must}`).toContain(must);
    }
  });

  it("A4/A5 is a GST tax invoice: HSN, GST table, amount in words, signature", () => {
    const html = receiptHtml({ sale, shop, footer: "", format: "a4" });
    expect(html).toContain("size: A4");
    expect(html).toContain("30049099");
    expect(html).toContain("Rupees Three Thousand Three Hundred Sixty Only");
    expect(html).toContain("Authorised signatory");
    expect(receiptHtml({ sale, shop, footer: "", format: "a5" })).toContain(
      "size: A5",
    );
  });

  it("thermal widths fit the roll", () => {
    expect(
      receiptHtml({ sale, shop, footer: "", format: "thermal80" }),
    ).toContain("width: 78mm");
    expect(
      receiptHtml({ sale, shop, footer: "", format: "thermal58" }),
    ).toContain("width: 51mm");
  });

  it("text from the bill can never become markup", () => {
    const html = receiptHtml({ sale, shop, footer: "", format: "thermal80" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("GST summary splits CGST/SGST per rate (IGST for another state)", () => {
    expect(gstSummary(sale)).toEqual([
      { rate: 5, taxable: 320000, cgst: 8000, sgst: 8000, igst: 0, gst: 16000 },
    ]);
    const b2b = { ...sale, customerGstin: "30AAPFU0939F1Z8", interstate: true };
    expect(gstSummary(b2b)[0]).toMatchObject({ cgst: 0, sgst: 0, igst: 16000 });
    const html = receiptHtml({ sale: b2b, shop, footer: "", format: "a4" });
    expect(html).toContain("Buyer GSTIN:</b> 30AAPFU0939F1Z8");
    expect(html).toContain("30-Goa");
    expect(html).toContain("<th>IGST</th>");
  });
});

describe("amount in words (Indian)", () => {
  it("uses lakh and crore", () => {
    expect(numberInWords(270)).toBe("Two Hundred Seventy");
    expect(numberInWords(1_25_430)).toBe(
      "One Lakh Twenty Five Thousand Four Hundred Thirty",
    );
    expect(numberInWords(2_03_00_015)).toBe("Two Crore Three Lakh Fifteen");
    expect(rupeesInWords(27050)).toBe(
      "Rupees Two Hundred Seventy and Fifty Paise Only",
    );
  });
});

describe("barcodes & labels", () => {
  it("EAN-13 check digit (real product codes)", () => {
    expect(isValidEan13("4006381333931")).toBe(true);
    expect(isValidEan13("4006381333932")).toBe(false);
  });

  it("in-store codes start with 2, are valid EAN-13 and never repeat", () => {
    let seed = 7;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    const first = newInStoreBarcode(new Set(), rnd);
    expect(first).toMatch(/^2\d{12}$/);
    expect(isValidEan13(first)).toBe(true);
    seed = 7; // same "dice" again → would repeat, so it must pick another
    expect(newInStoreBarcode(new Set([first]), rnd)).not.toBe(first);
  });

  it("roll labels: one label per page at the label size; A4 sheets: grid pages", () => {
    const item = {
      name: "Cotton 50g",
      price: "MRP ₹40.00",
      barcodeSvg: "<svg></svg>",
    };
    const roll = labelsHtml([item, item], "50x25", "Shop");
    expect(roll).toContain("size: 50mm 25mm");
    expect(roll.match(/class="lbl"/g)).toHaveLength(2);
    const sheet = labelsHtml(Array(70).fill(item), "a4-65", "Shop");
    expect(sheet.match(/class="sheet"/g)).toHaveLength(2); // 65 + 5
    expect(labelsHtml([{ ...item, name: "<b>x" }], "38x25", "S")).toContain(
      "&lt;b&gt;x",
    );
  });
});

describe("bill on WhatsApp", () => {
  it("accepts Indian mobiles in any style, refuses the rest", async () => {
    const { whatsappNumber } = await import("./whatsapp");
    expect(whatsappNumber("98765 43210")).toBe("919876543210");
    expect(whatsappNumber("+91-98765-43210")).toBe("919876543210");
    expect(whatsappNumber("09876543210")).toBe("919876543210");
    expect(whatsappNumber("02225401234")).toBeNull(); // landline
    expect(whatsappNumber("12345")).toBeNull();
  });

  it("writes a short bill and a wa.me link", async () => {
    const { billMessage, whatsappLink } = await import("./whatsapp");
    const sale = {
      billNo: "INV-0042",
      createdAt: "2026-10-08T09:00:00Z",
      lines: [
        {
          medicineName: "Dolo 650",
          qtyStrip: 1,
          qtyLoose: 0,
          unit: "STP",
          amountPaise: 2700,
        },
      ],
      totals: { netPaise: 2700 },
    } as never;
    const text = billMessage(sale, "Sharma Medicals", "Get well soon");
    expect(text).toContain("*Sharma Medicals*");
    expect(text).toContain("Dolo 650 × 1 STP — ₹27.00");
    expect(text).toContain("*Total: ₹27.00*");
    expect(whatsappLink("919876543210", text)).toMatch(
      /^https:\/\/wa\.me\/919876543210\?text=\*Sharma/,
    );
  });
});
