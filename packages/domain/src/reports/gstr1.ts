/**
 * GSTR-1 (monthly / quarterly return of sales) — the files the free GST
 * Offline Tool imports (Import Files → CSV, one per section), the same
 * sheets Tally / Busy export. The shop or its CA imports them, checks,
 * and uploads the JSON the tool makes. Nothing here needs a paid GSP.
 *
 *   b2b.csv        bills with the buyer's GSTIN (table 4A)
 *   b2cs.csv       all other bills, per GST rate (table 7)
 *   cdnr.csv       returns of B2B bills = credit notes (table 9B)
 *   hsn(b2b).csv   HSN-wise summary, B2B tab (table 12)
 *   hsn(b2c).csv   HSN-wise summary, B2C tab (table 12)
 *   docs.csv       numbers of documents issued (table 13)
 *
 * Retail returns (no GSTIN) reduce b2cs and the B2C HSN tab, as
 * shops normally report them. Pharmacy counter sales are always within
 * the shop's own state; a B2B buyer from another state is IGST.
 */
import type { Sale, SaleReturn } from "../billing/types";
import { toCsv } from "../lib/csv";
import { splitInclusive } from "../lib/gst";
import { placeOfSupply } from "../lib/gstin";
import type { PackUnit } from "../medicines/types";
import { inRange, type DateRange } from "./period";

type Tax = { taxable: number; igst: number; cgst: number; sgst: number };

export type B2bRow = Tax & {
  gstin: string;
  name: string;
  invoiceNo: string;
  date: string;
  /** Whole invoice value (all rates) */
  invoiceValue: number;
  rate: number;
};
export type B2csRow = Tax & { rate: number };
export type CdnrRow = Tax & {
  gstin: string;
  name: string;
  noteNo: string;
  date: string;
  noteValue: number;
  rate: number;
};
export type HsnRow = Tax & {
  hsn: string;
  uqc: string;
  qty: number;
  value: number;
  rate: number;
};
export type DocRow = {
  nature: string;
  from: string;
  to: string;
  total: number;
  cancelled: number;
};

export type Gstr1 = {
  b2b: B2bRow[];
  b2cs: B2csRow[];
  cdnr: CdnrRow[];
  hsnB2b: HsnRow[];
  hsnB2c: HsnRow[];
  docs: DocRow[];
  /** Shop's state, e.g. "27-Maharashtra" */
  pos: string;
};

const ZERO: Tax = { taxable: 0, igst: 0, cgst: 0, sgst: 0 };

/** Paise of GST → IGST, or CGST + SGST halves */
function split(taxable: number, gst: number, interstate: boolean): Tax {
  if (interstate) return { taxable, igst: gst, cgst: 0, sgst: 0 };
  const cgst = Math.floor(gst / 2);
  return { taxable, igst: 0, cgst, sgst: gst - cgst };
}
const add = (a: Tax, b: Tax, sign = 1): Tax => ({
  taxable: a.taxable + sign * b.taxable,
  igst: a.igst + sign * b.igst,
  cgst: a.cgst + sign * b.cgst,
  sgst: a.sgst + sign * b.sgst,
});

/** Unit Quantity Code as the GST tool lists it */
const UQC: Record<PackUnit, string> = {
  STP: "PAC-PACKS",
  BTL: "BTL-BOTTLES",
  BOX: "BOX-BOX",
  LSE: "NOS-NUMBERS",
};
/** Strips + loose tablets → packs (2 decimals) */
const packs = (strip: number, loose: number, unit: PackUnit, per: number) =>
  unit === "LSE" ? loose : strip + (per > 0 ? loose / per : 0);

export function gstr1(
  sales: readonly Sale[],
  saleReturns: readonly SaleReturn[],
  range: DateRange,
  shopGstin: string,
): Gstr1 {
  const pos = placeOfSupply(shopGstin);
  const b2b: B2bRow[] = [];
  const b2cs = new Map<number, B2csRow>();
  const hsn = {
    b2b: new Map<string, HsnRow>(),
    b2c: new Map<string, HsnRow>(),
  };
  const bills: string[] = [];

  const toHsn = (
    tab: "b2b" | "b2c",
    l: {
      hsn: string;
      unit: PackUnit;
      unitsPerStrip: number;
      gstPercent: number;
    },
    qty: number,
    value: number,
    tax: Tax,
    sign: number,
  ) => {
    const code = l.hsn.replace(/\D/g, "") || "3004";
    const key = `${code}|${l.gstPercent}|${l.unit}`;
    const row = hsn[tab].get(key) ?? {
      hsn: code,
      uqc: UQC[l.unit],
      qty: 0,
      value: 0,
      rate: l.gstPercent,
      ...ZERO,
    };
    Object.assign(row, add(row, tax, sign));
    row.qty += sign * qty;
    row.value += sign * value;
    hsn[tab].set(key, row);
  };
  const toB2cs = (rate: number, tax: Tax, sign: number) => {
    const row = b2cs.get(rate) ?? { rate, ...ZERO };
    b2cs.set(rate, { rate, ...add(row, tax, sign) });
  };

  const lineOf = new Map<string, { sale: Sale; line: Sale["lines"][number] }>();
  for (const s of sales) {
    for (const l of s.lines) lineOf.set(l.id, { sale: s, line: l });
    if (!inRange(s.createdAt, range)) continue;
    bills.push(s.billNo);
    const inter = s.interstate === true;
    const byRate = new Map<number, Tax>();
    for (const l of s.lines) {
      const tax = split(l.taxablePaise, l.gstPaise, inter);
      byRate.set(l.gstPercent, add(byRate.get(l.gstPercent) ?? ZERO, tax));
      const qty = packs(l.qtyStrip, l.qtyLoose, l.unit, l.unitsPerStrip);
      toHsn(s.customerGstin ? "b2b" : "b2c", l, qty, l.amountPaise, tax, 1);
      if (!s.customerGstin) toB2cs(l.gstPercent, tax, 1);
    }
    if (s.customerGstin)
      for (const [rate, tax] of byRate)
        b2b.push({
          gstin: s.customerGstin,
          name: s.customerName,
          invoiceNo: s.billNo,
          date: s.createdAt,
          invoiceValue: s.totals.netPaise,
          rate,
          ...tax,
        });
  }

  // Returns: B2B → credit notes; retail → reduce b2cs
  const cdnr: CdnrRow[] = [];
  const notes: string[] = [];
  for (const r of saleReturns) {
    if (!inRange(r.createdAt, range)) continue;
    notes.push(r.returnNo);
    const byRate = new Map<number, Tax>();
    let gstin = "";
    let name = r.customerName;
    for (const rl of r.lines) {
      const src = lineOf.get(rl.saleLineId);
      if (!src) continue; // its bill wasn't loaded (never happens via the API)
      const { sale, line } = src;
      const { taxablePaise, gstPaise } = splitInclusive(
        rl.amountPaise,
        line.gstPercent,
      );
      const tax = split(taxablePaise, gstPaise, sale.interstate === true);
      const qty = packs(
        rl.qtyStrip,
        rl.qtyLoose,
        line.unit,
        line.unitsPerStrip,
      );
      toHsn(
        sale.customerGstin ? "b2b" : "b2c",
        line,
        qty,
        rl.amountPaise,
        tax,
        -1,
      );
      if (sale.customerGstin) {
        gstin = sale.customerGstin;
        name = sale.customerName;
        byRate.set(
          line.gstPercent,
          add(byRate.get(line.gstPercent) ?? ZERO, tax),
        );
      } else toB2cs(line.gstPercent, tax, -1);
    }
    for (const [rate, tax] of byRate)
      cdnr.push({
        gstin,
        name,
        noteNo: r.returnNo,
        date: r.createdAt,
        noteValue: r.refundPaise,
        rate,
        ...tax,
      });
  }

  const sortNo = (a: string, b: string) =>
    a.localeCompare(b, "en", { numeric: true });
  const docs: DocRow[] = [];
  if (bills.length) {
    bills.sort(sortNo);
    docs.push({
      nature: "Invoices for outward supply",
      from: bills[0],
      to: bills.at(-1)!,
      total: bills.length,
      cancelled: 0,
    });
  }
  if (notes.length) {
    notes.sort(sortNo);
    docs.push({
      nature: "Credit Note",
      from: notes[0],
      to: notes.at(-1)!,
      total: notes.length,
      cancelled: 0,
    });
  }

  const byHsn = (a: HsnRow, b: HsnRow) =>
    a.hsn.localeCompare(b.hsn) || a.rate - b.rate;
  return {
    b2b: b2b.sort((a, b) => sortNo(a.invoiceNo, b.invoiceNo)),
    b2cs: [...b2cs.values()]
      .filter((r) => r.taxable !== 0)
      .sort((a, b) => a.rate - b.rate),
    cdnr,
    hsnB2b: [...hsn.b2b.values()].filter((r) => r.value !== 0).sort(byHsn),
    hsnB2c: [...hsn.b2c.values()].filter((r) => r.value !== 0).sort(byHsn),
    docs,
    pos,
  };
}

/* ---------------- Files for the GST Offline Tool ---------------- */

/** Paise → rupees with 2 decimals, as a number */
const rs = (p: number) => Math.round(p) / 100;
const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
/** "15-Oct-2026" — the date style of the GST tool's CSV files */
export const gstDate = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
};

export function gstr1Files(r: Gstr1): { name: string; csv: string }[] {
  const csv = <T>(rows: T[], cols: [string, (x: T) => string | number][]) =>
    toCsv(
      rows,
      cols.map(([header, value]) => ({ header, value })),
      { bom: false },
    );
  const hsnCols: [string, (x: HsnRow) => string | number][] = [
    ["HSN", (x) => x.hsn],
    ["Description", () => ""],
    ["UQC", (x) => x.uqc],
    ["Total Quantity", (x) => Math.round(x.qty * 100) / 100],
    ["Total Value", (x) => rs(x.value)],
    ["Rate", (x) => x.rate],
    ["Taxable Value", (x) => rs(x.taxable)],
    ["Integrated Tax Amount", (x) => rs(x.igst)],
    ["Central Tax Amount", (x) => rs(x.cgst)],
    ["State/UT Tax Amount", (x) => rs(x.sgst)],
    ["Cess Amount", () => 0],
  ];
  return [
    {
      name: "b2b.csv",
      csv: csv(r.b2b, [
        ["GSTIN/UIN of Recipient", (x) => x.gstin],
        ["Receiver Name", (x) => x.name],
        ["Invoice Number", (x) => x.invoiceNo],
        ["Invoice date", (x) => gstDate(x.date)],
        ["Invoice Value", (x) => rs(x.invoiceValue)],
        ["Place Of Supply", (x) => placeOfSupply(x.gstin)],
        ["Reverse Charge", () => "N"],
        ["Applicable % of Tax Rate", () => ""],
        ["Invoice Type", () => "Regular B2B"],
        ["E-Commerce GSTIN", () => ""],
        ["Rate", (x) => x.rate],
        ["Taxable Value", (x) => rs(x.taxable)],
        ["Cess Amount", () => 0],
      ]),
    },
    {
      name: "b2cs.csv",
      csv: csv(r.b2cs, [
        ["Type", () => "OE"],
        ["Place Of Supply", () => r.pos],
        ["Applicable % of Tax Rate", () => ""],
        ["Rate", (x) => x.rate],
        ["Taxable Value", (x) => rs(x.taxable)],
        ["Cess Amount", () => 0],
        ["E-Commerce GSTIN", () => ""],
      ]),
    },
    {
      name: "cdnr.csv",
      csv: csv(r.cdnr, [
        ["GSTIN/UIN of Recipient", (x) => x.gstin],
        ["Receiver Name", (x) => x.name],
        ["Note Number", (x) => x.noteNo],
        ["Note Date", (x) => gstDate(x.date)],
        ["Note Type", () => "C"],
        ["Place Of Supply", (x) => placeOfSupply(x.gstin)],
        ["Reverse Charge", () => "N"],
        ["Note Supply Type", () => "Regular B2B"],
        ["Note Value", (x) => rs(x.noteValue)],
        ["Applicable % of Tax Rate", () => ""],
        ["Rate", (x) => x.rate],
        ["Taxable Value", (x) => rs(x.taxable)],
        ["Cess Amount", () => 0],
      ]),
    },
    { name: "hsn(b2b).csv", csv: csv(r.hsnB2b, hsnCols) },
    { name: "hsn(b2c).csv", csv: csv(r.hsnB2c, hsnCols) },
    {
      name: "docs.csv",
      csv: csv(r.docs, [
        ["Nature of Document", (x) => x.nature],
        ["Sr. No. From", (x) => x.from],
        ["Sr. No. To", (x) => x.to],
        ["Total Number", (x) => x.total],
        ["Cancelled", (x) => x.cancelled],
      ]),
    },
  ];
}
