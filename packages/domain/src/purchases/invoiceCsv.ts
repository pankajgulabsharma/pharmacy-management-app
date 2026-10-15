/**
 * Distributor's invoice file (CSV from Marg / Retailio / any software, or
 * Excel → Save as CSV) → purchase lines, so the shop doesn't type 40 lines
 * by hand. Columns are matched loosely ("Item Name", "Batch", "Exp", "Qty",
 * "Free", "P.Rate", "MRP", "Disc%", "GST%"…).
 *
 * Medicines are matched by barcode, then by exact name. Anything else is
 * NOT guessed silently — the screen shows it with a suggestion to accept.
 */
import { csvRecords } from "../lib/csv";
import { toExpiryMMYY } from "../lib/expiry";
import { isGstRate } from "../lib/gst";
import { medicineSearch } from "../medicines/search";
import type { Medicine } from "../medicines/types";
import { createLineFromMedicine } from "./draft";
import { PURCHASE_LIMITS, type PurchaseLineDraft } from "./types";

const ALIASES = {
  name: [
    "name",
    "item",
    "item name",
    "itemname",
    "product",
    "product name",
    "medicine",
    "description",
    "particulars",
  ],
  barcode: ["barcode", "bar code", "ean", "ean code"],
  batch: ["batch", "batch no", "batchno", "batch number"],
  expiry: ["expiry", "exp", "exp date", "expiry date", "expdate"],
  qty: [
    "qty",
    "quantity",
    "billed qty",
    "bill qty",
    "pur qty",
    "qty purchased",
  ],
  free: ["free", "free qty", "fqty", "scheme", "sch qty", "bonus"],
  rate: [
    "rate",
    "p rate",
    "prate",
    "pur rate",
    "purchase rate",
    "purchase price",
    "cost",
    "ptr",
  ],
  mrp: ["mrp", "m r p", "mrp rs"],
  discount: [
    "disc",
    "disc %",
    "discount",
    "discount %",
    "cd",
    "cd %",
    "disc per",
  ],
  gst: ["gst", "gst %", "gst rate", "tax", "tax %", "igst %"],
  invoice: ["invoice no", "bill no", "invoice", "inv no", "voucher no"],
  date: ["invoice date", "bill date", "date", "inv date", "voucher date"],
} as const;
type Field = keyof typeof ALIASES;

export type UnmatchedRow = {
  row: number;
  name: string;
  /** Best guess from the shop's medicines (accept with one click) */
  suggestion: Medicine | null;
  /** The line it would become once a medicine is chosen */
  values: Omit<
    PurchaseLineDraft,
    | "key"
    | "medicineId"
    | "medicineName"
    | "brand"
    | "hsn"
    | "unit"
    | "unitsPerStrip"
    | "gstPercent"
  > & {
    /** null = not in the file → the medicine's own GST */
    gstPercent: PurchaseLineDraft["gstPercent"] | null;
  };
};

export type InvoiceImport = {
  lines: PurchaseLineDraft[];
  unmatched: UnmatchedRow[];
  problems: { row: number; message: string }[];
  /** From the file when it has them (first row) */
  invoiceNo: string;
  invoiceDate: string;
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const num = (v = "") => {
  const n = Number(v.replace(/[₹,\s%]|rs\.?/gi, ""));
  return Number.isFinite(n) ? n : NaN;
};

/** Whole number as typed in the line editor ("" when empty / 0) */
const count = (v = "") => {
  const n = Math.trunc(num(v));
  return n > 0 ? String(n) : "";
};
const money = (v = "") => {
  const n = num(v);
  return n > 0 ? String(Math.round(n * 100) / 100) : "";
};

/** "31-03-2026", "2026-03-31", "31/03/26" → "2026-03-31" ("" if unreadable) */
function isoDate(raw = ""): string {
  const s = raw.trim();
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/.exec(s);
  if (!m) return "";
  const y = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

export function parseInvoiceCsv(
  text: string,
  medicines: readonly Medicine[],
): InvoiceImport {
  const out: InvoiceImport = {
    lines: [],
    unmatched: [],
    problems: [],
    invoiceNo: "",
    invoiceDate: "",
  };
  const { records, found } = csvRecords(text, ALIASES);
  if (!found.includes("name")) {
    out.problems.push({ row: 1, message: "No “item name” column found" });
    return out;
  }
  if (!found.includes("qty")) {
    out.problems.push({ row: 1, message: "No “qty” column found" });
    return out;
  }

  const active = medicines.filter((m) => m.status === "active");
  const byCode = new Map(
    active.filter((m) => m.barcode).map((m) => [m.barcode, m]),
  );
  const byName = new Map(active.map((m) => [norm(m.name), m]));

  for (const [i, r] of records.entries()) {
    const row = i + 2;
    const get = (f: Field) => r[f] ?? "";
    const name = get("name");
    // Totals / blank lines at the end of distributor files
    if (!name || /^(total|grand total|net amount|sub total)/i.test(name))
      continue;
    if (!out.invoiceNo && get("invoice"))
      out.invoiceNo = get("invoice").slice(0, PURCHASE_LIMITS.invoiceNoMax);
    if (!out.invoiceDate && get("date")) out.invoiceDate = isoDate(get("date"));

    const qty = count(get("qty"));
    const free = count(get("free"));
    if (!qty && !free) {
      out.problems.push({ row, message: `${name}: quantity missing` });
      continue;
    }
    const gst = num(get("gst"));
    const values: UnmatchedRow["values"] = {
      batchNo: get("batch")
        .toUpperCase()
        .replace(/\s+/g, "")
        .slice(0, PURCHASE_LIMITS.batchNoMax),
      expiry: toExpiryMMYY(get("expiry")),
      qty,
      freeQty: free,
      rate: money(get("rate")),
      mrp: money(get("mrp")),
      discountPercent:
        num(get("discount")) > 0 ? String(num(get("discount"))) : "",
      gstPercent: isGstRate(gst) ? gst : null,
    };
    const code = get("barcode").replace(/\s/g, "");
    const m = (code && byCode.get(code)) || byName.get(norm(name));
    if (m) {
      out.lines.push(fillLine(m, values));
    } else {
      out.unmatched.push({
        row,
        name,
        suggestion: suggest(active, name),
        values,
      });
    }
  }
  return out;
}

/**
 * Closest of the shop's medicines for a name the file spells differently
 * ("TELMA 40MG TAB" → Telma 40 Tablet). Only a suggestion: the shop
 * accepts it with a click.
 */
function suggest(active: readonly Medicine[], name: string): Medicine | null {
  const spaced = name.replace(/(\d)([a-z])/gi, "$1 $2");
  const brand = name.trim().split(/\s+/)[0] ?? "";
  for (const q of [name, spaced, brand]) {
    if (q.trim().length < 3) continue;
    const hit = medicineSearch.filter(active, q)[0];
    if (hit) return hit;
  }
  return null;
}

/** A medicine + the file's numbers → a purchase line (file wins if given) */
export function fillLine(
  m: Medicine,
  v: UnmatchedRow["values"],
): PurchaseLineDraft {
  const line = createLineFromMedicine(m);
  return {
    ...line,
    batchNo: v.batchNo,
    expiry: v.expiry,
    qty: v.qty,
    freeQty: v.freeQty,
    rate: v.rate,
    mrp: v.mrp || line.mrp,
    discountPercent: v.discountPercent,
    gstPercent: v.gstPercent ?? line.gstPercent,
  };
}

/** A sample file, so a shop can see the columns we read */
export const INVOICE_SAMPLE_CSV = [
  "Invoice No,Invoice Date,Item Name,Batch,Exp,Qty,Free,P.Rate,MRP,Disc %,GST %",
  "AGN/2451,15-10-2026,Dolo 650 Tablet,DL65099,08/28,20,2,22.50,30,0,5",
  "AGN/2451,15-10-2026,Azithromycin 500mg Tablet,AZ5501,11/27,10,0,78,120,2,12",
].join("\r\n");
