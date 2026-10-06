import { DEFAULT_GST_RATE, isGstRate } from "../lib/gst";
import type {
  MedicineInput,
  MedicineCategory,
  PackUnit,
  MedicineStatus,
} from "./types";
import { defaultsForCategory } from "./types";

export const MEDICINE_CSV_HEADERS = [
  "name",
  "salt",
  "brand",
  "category",
  "hsn",
  "barcode",
  "rack",
  "unit",
  "units_per_strip",
  "allow_loose",
  "mrp",
  "sale_price",
  "min_stock",
  "gst",
  "status",
] as const;

const CATEGORY_MAP: Record<string, MedicineCategory> = {
  tablet_capsule: "tablet_capsule",
  tablets: "tablet_capsule",
  tablet: "tablet_capsule",
  capsule: "tablet_capsule",
  syrup_suspension: "syrup_suspension",
  syrup: "syrup_suspension",
  suspension: "syrup_suspension",
  cream_ointment: "cream_ointment",
  cream: "cream_ointment",
  ointment: "cream_ointment",
  injection: "injection",
  injections: "injection",
  drops: "drops",
  drop: "drops",
  inhaler: "inhaler",
  inhalers: "inhaler",
  respule: "inhaler",
  sachet_powder: "sachet_powder",
  sachet: "sachet_powder",
  sachets: "sachet_powder",
  powder: "sachet_powder",
  other: "other",
};

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

export function buildSampleCsv(): string {
  const header = MEDICINE_CSV_HEADERS.join(",");
  const rows = [
    "Sample Para 500,Paracetamol,Cipla,tablet_capsule,30049099,8901000000001,A1,STP,10,true,30,27,20,5,active",
    "Sample Syrup 100ml,Ambroxol,Dr Reddy,syrup_suspension,30049099,8901000000002,E1,BTL,1,false,95,88,10,5,active",
    "Sample Para Box,Paracetamol,Cipla,tablet_capsule,30049099,8901000000003,A1,BOX,10,false,300,270,2,5,active",
    "Sample Eye Drops,CMC,Allergan,drops,30049099,8901000000004,DR-1,BTL,1,false,185,168,8,5,active",
  ];
  return [header, ...rows].join("\n");
}

export type CsvRowResult =
  | {
      ok: true;
      data: MedicineInput;
    }
  | { ok: false; row: number; message: string };

export function parseMedicineCsv(text: string): CsvRowResult[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [
      {
        ok: false,
        row: 0,
        message: "CSV must have header + at least 1 data row",
      },
    ];
  }

  const headers = parseCsvLine(lines[0]).map((h) =>
    h.toLowerCase().replace(/\s+/g, "_"),
  );
  const results: CsvRowResult[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const get = (key: string) => {
      const idx = headers.indexOf(key);
      return idx >= 0 ? (cols[idx] ?? "").trim() : "";
    };

    const name = get("name");
    if (!name) {
      results.push({ ok: false, row: i + 1, message: "name is required" });
      continue;
    }

    const catRaw = get("category").toLowerCase() || "tablet_capsule";
    const category = CATEGORY_MAP[catRaw] ?? "other";
    const defaults = defaultsForCategory(category);

    let unit = (get("unit").toUpperCase() || defaults.unit) as PackUnit;
    if (unit !== "STP" && unit !== "BTL" && unit !== "LSE" && unit !== "BOX") {
      unit = defaults.unit;
    }

    const ups = Number(get("units_per_strip") || defaults.unitsPerStrip);
    if (Number.isNaN(ups) || ups < 1) {
      results.push({
        ok: false,
        row: i + 1,
        message: "invalid units_per_strip",
      });
      continue;
    }

    const mrp = Number(get("mrp"));
    const salePrice = Number(get("sale_price"));
    if (
      Number.isNaN(mrp) ||
      mrp < 0 ||
      Number.isNaN(salePrice) ||
      salePrice < 0
    ) {
      results.push({
        ok: false,
        row: i + 1,
        message: "invalid mrp / sale_price",
      });
      continue;
    }
    if (salePrice > mrp) {
      results.push({ ok: false, row: i + 1, message: "sale_price > mrp" });
      continue;
    }

    const allowRaw = get("allow_loose").toLowerCase();
    let allowLoose =
      allowRaw === "true" || allowRaw === "1" || allowRaw === "yes"
        ? true
        : allowRaw === "false" || allowRaw === "0" || allowRaw === "no"
          ? false
          : defaults.allowLoose;

    // Loose only for STP / LSE
    if (unit !== "STP" && unit !== "LSE") allowLoose = false;

    const statusRaw = get("status").toLowerCase() || "active";
    const status: MedicineStatus =
      statusRaw === "inactive" ? "inactive" : "active";

    const minStock = Number(get("min_stock") || "10");
    // Optional column — older files without it get the default slab
    const gstRaw = Number(get("gst") || DEFAULT_GST_RATE);
    if (!isGstRate(gstRaw)) {
      results.push({
        ok: false,
        row: i + 1,
        message: "gst must be 0, 5, 12 or 18",
      });
      continue;
    }
    const hsn = get("hsn");
    if (hsn && !/^\d{4,8}$/.test(hsn)) {
      results.push({ ok: false, row: i + 1, message: "invalid hsn" });
      continue;
    }

    results.push({
      ok: true,
      data: {
        name,
        salt: get("salt"),
        brand: get("brand") || "—",
        category,
        hsn: hsn || "0000",
        barcode: get("barcode"),
        rack: get("rack"),
        unit,
        unitsPerStrip: ups,
        allowLoose,
        mrp,
        salePrice,
        minStock: Number.isNaN(minStock) ? 10 : minStock,
        gstPercent: gstRaw,
        status,
      },
    });
  }

  return results;
}
