/**
 * Import medicines — and, if the file has them, opening stock (batches) —
 * from a CSV: our own sample, Excel, or an export from other pharmacy
 * software (Marg, Tally, GoFrugal…). Column names are matched loosely
 * (“Item Name”, “Product”, “Exp”, “Cl. Stock”, “P.Rate”…), one row per
 * batch is fine (same medicine on many rows → one medicine, many batches).
 */
import { csvRecords, toCsv } from "../lib/csv";
import { toExpiryMMYY } from "../lib/expiry";
import { DEFAULT_GST_RATE, isGstRate } from "../lib/gst";
import { isSchedule } from "./schedule";
import {
  CATEGORY_LABELS,
  defaultsForCategory,
  type MedicineCategory,
  type MedicineInput,
  type PackUnit,
} from "./types";

/** What the file's columns may be called (lower case, words only) */
const ALIASES = {
  name: [
    "name",
    "item",
    "item name",
    "itemname",
    "product",
    "product name",
    "medicine",
    "medicine name",
    "description",
    "particulars",
  ],
  salt: [
    "salt",
    "composition",
    "generic",
    "generic name",
    "content",
    "molecule",
  ],
  brand: [
    "brand",
    "company",
    "company name",
    "mfr",
    "mfg",
    "manufacturer",
    "comp",
  ],
  category: ["category", "type", "form", "dosage form", "item type"],
  hsn: ["hsn", "hsn code", "hsn sac", "hsncode"],
  barcode: ["barcode", "bar code", "ean", "ean code"],
  rack: ["rack", "location", "shelf", "rack no"],
  unit: ["unit", "uom"],
  units_per_strip: [
    "units per strip",
    "units per pack",
    "pack",
    "packing",
    "pack size",
    "conversion",
    "conv",
  ],
  allow_loose: ["allow loose", "loose allowed"],
  mrp: ["mrp", "m r p", "mrp rs"],
  sale_price: [
    "sale price",
    "selling price",
    "rate",
    "s rate",
    "srate",
    "sale rate",
    "price",
  ],
  min_stock: [
    "min stock",
    "minimum stock",
    "reorder",
    "reorder level",
    "min qty",
  ],
  gst: [
    "gst",
    "gst%",
    "gst %",
    "tax",
    "tax%",
    "tax %",
    "gst rate",
    "igst",
    "igst%",
  ],
  schedule: ["schedule", "sch", "drug schedule"],
  status: ["status", "active"],
  batch: ["batch", "batch no", "batchno", "batch number"],
  expiry: ["expiry", "exp", "exp date", "expiry date", "expdate"],
  qty: [
    "qty",
    "quantity",
    "stock",
    "closing stock",
    "cl stock",
    "balance",
    "bal qty",
    "opening stock",
    "op stock",
  ],
  purchase_price: [
    "purchase price",
    "purchase rate",
    "p rate",
    "prate",
    "pur rate",
    "cost",
    "cost price",
  ],
} as const;
type Field = keyof typeof ALIASES;

const CATEGORY_WORDS: [RegExp, MedicineCategory][] = [
  [/tab|cap|tablet|capsule/, "tablet_capsule"],
  [/syr|susp|liquid/, "syrup_suspension"],
  [/cream|oint|gel|lotion/, "cream_ointment"],
  [/inj|vial|amp/, "injection"],
  [/drop/, "drops"],
  [/inhal|respule|rotacap/, "inhaler"],
  [/sachet|powder|pwd/, "sachet_powder"],
];

/** Opening stock found on a row */
export type OpeningStock = {
  batchNo: string;
  expiry: string;
  /** Packs (strips / bottles / boxes; loose units for loose-only items) */
  qty: number;
  mrp: number;
  purchasePrice: number;
};

export type ImportRow = { medicine: MedicineInput; opening?: OpeningStock };

export type CsvRowResult =
  ({ ok: true } & ImportRow) | { ok: false; row: number; message: string };

const num = (v = "") => {
  const n = Number(v.replace(/[₹,\s%]|rs\.?/gi, ""));
  return Number.isFinite(n) ? n : NaN;
};

function categoryOf(text: string): MedicineCategory {
  const t = text.toLowerCase();
  if (t in CATEGORY_LABELS) return t as MedicineCategory;
  return CATEGORY_WORDS.find(([re]) => re.test(t))?.[1] ?? "other";
}

/** "10's", "1x15", "15 TAB" → units per strip (strips / tablets only) */
function unitsFrom(pack: string, fallback: number) {
  const n = (pack.match(/\d+/g) ?? [])
    .map(Number)
    .filter((x) => x > 0 && x <= 500);
  return n.length ? Math.max(...n) : fallback;
}

export function parseMedicineCsv(text: string): CsvRowResult[] {
  const { records, found } = csvRecords(text, ALIASES);
  if (!found.includes("name"))
    return [
      { ok: false, row: 1, message: "No “name” / “item name” column found" },
    ];
  if (records.length === 0)
    return [{ ok: false, row: 1, message: "The file has no rows" }];

  return records.map((r, i): CsvRowResult => {
    const row = i + 2;
    const fail = (message: string) => ({ ok: false as const, row, message });
    const get = (f: Field) => r[f] ?? "";
    const name = get("name");
    if (!name) return fail("name is required");

    // The name usually tells the form ("… Tablet", "… Syrup 100ml")
    const category = categoryOf(get("category") || name);
    const d = defaultsForCategory(category);
    const u = get("unit").toUpperCase();
    const unit: PackUnit = (["STP", "BTL", "LSE", "BOX"] as const).includes(
      u as PackUnit,
    )
      ? (u as PackUnit)
      : d.unit;

    const mrp = num(get("mrp"));
    if (!(mrp > 0)) return fail("MRP missing or invalid");
    const sale = get("sale_price") ? num(get("sale_price")) : mrp;
    if (!(sale >= 0)) return fail("invalid sale price");
    const gst = get("gst") ? num(get("gst")) : DEFAULT_GST_RATE;
    if (!isGstRate(gst)) return fail("GST must be 0, 5, 12 or 18");
    const hsn = get("hsn").replace(/\D/g, "");
    const loose = get("allow_loose").toLowerCase();
    const sch = get("schedule")
      .toUpperCase()
      .replace(/^SCH(EDULE)?\s*/, "");

    const medicine: MedicineInput = {
      name,
      salt: get("salt"),
      brand: get("brand") || "—",
      category,
      hsn: hsn.length >= 4 ? hsn : "3004",
      barcode: get("barcode").replace(/\s/g, ""),
      rack: get("rack"),
      unit,
      unitsPerStrip:
        unit === "STP" || unit === "BOX"
          ? unitsFrom(get("units_per_strip"), Number(d.unitsPerStrip) || 1)
          : 1,
      allowLoose:
        unit === "STP" || unit === "LSE"
          ? loose
            ? /^(true|1|yes|y)$/.test(loose)
            : d.allowLoose
          : false,
      mrp,
      // Selling above MRP is illegal — cap it
      salePrice: Math.min(sale, mrp),
      minStock: Math.max(0, Math.trunc(num(get("min_stock")) || 10)),
      gstPercent: gst,
      schedule: isSchedule(sch) ? sch : "",
      status: /^(inactive|no|0|false)$/i.test(get("status"))
        ? "inactive"
        : "active",
    };

    // Opening stock — only when the row has a quantity
    const qty = num(get("qty"));
    if (!get("qty") || !(qty > 0)) return { ok: true, medicine };
    if (!Number.isInteger(qty))
      return fail("stock quantity must be whole packs");
    const expiry = toExpiryMMYY(get("expiry"));
    if (!expiry) return fail("expiry missing or unreadable (use MM/YY)");
    const cost = get("purchase_price") ? num(get("purchase_price")) : NaN;
    return {
      ok: true,
      medicine,
      opening: {
        batchNo:
          (get("batch") || "OPENING")
            .toUpperCase()
            .replace(/[^A-Z0-9\-/]/g, "")
            .slice(0, 20) || "OPENING",
        expiry,
        qty,
        mrp,
        // No purchase rate in the file → estimate (needed for profit reports)
        purchasePrice:
          cost >= 0 ? Math.min(cost, mrp) : Math.round(mrp * 70) / 100,
      },
    };
  });
}

/** A sample file showing the columns (opening-stock columns optional) */
export function buildSampleCsv(): string {
  type R = Record<string, string | number>;
  const rows: R[] = [
    {
      name: "Sample Para 500",
      salt: "Paracetamol",
      brand: "Cipla",
      category: "tablet_capsule",
      hsn: "30049099",
      barcode: "",
      rack: "A1",
      unit: "STP",
      units_per_strip: 10,
      mrp: 30,
      sale_price: 27,
      gst: 5,
      schedule: "",
      batch: "SP2401",
      expiry: "12/27",
      qty: 40,
      purchase_price: 21,
    },
    {
      name: "Sample Azithro 500",
      salt: "Azithromycin",
      brand: "Alembic",
      category: "tablet_capsule",
      hsn: "30042019",
      barcode: "",
      rack: "B2",
      unit: "STP",
      units_per_strip: 3,
      mrp: 120,
      sale_price: 110,
      gst: 12,
      schedule: "H",
      batch: "AZ771",
      expiry: "06/27",
      qty: 15,
      purchase_price: 80,
    },
    {
      name: "Sample Syrup 100ml",
      salt: "Ambroxol",
      brand: "Dr Reddy",
      category: "syrup_suspension",
      hsn: "30049099",
      barcode: "",
      rack: "E1",
      unit: "BTL",
      units_per_strip: 1,
      mrp: 95,
      sale_price: 88,
      gst: 5,
      schedule: "",
      batch: "",
      expiry: "",
      qty: "",
      purchase_price: "",
    },
  ];
  const keys = Object.keys(rows[0]);
  return toCsv(
    rows,
    keys.map((k) => ({ header: k, value: (r: R) => r[k] })),
  );
}
