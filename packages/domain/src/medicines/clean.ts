/**
 * Normalise and bound a medicine before it is saved — used by the app AND
 * the server, so both always store exactly the same thing.
 */
import { DEFAULT_GST_RATE, isGstRate } from "../lib/gst";
import { cleanCode, cleanText } from "../lib/sanitize";
import {
  CATEGORY_LABELS,
  PACK_UNIT_LABELS,
  type MedicineCategory,
  type MedicineInput,
  type PackUnit,
} from "./types";

/** Most rows one CSV import may add */
export const MAX_MEDICINE_IMPORT = 5000;

export const MEDICINE_CATEGORIES = Object.keys(
  CATEGORY_LABELS,
) as MedicineCategory[];
export const PACK_UNITS = Object.keys(PACK_UNIT_LABELS) as PackUnit[];

const clamp = (n: number, min: number, max: number, fallback: number) =>
  Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;

/** Never trust callers: every field is trimmed, bounded and made consistent */
export function cleanMedicineInput(input: MedicineInput): MedicineInput {
  const loosePossible = input.unit === "STP" || input.unit === "LSE";
  const mrp = clamp(input.mrp, 0, 1_000_000, 0);
  return {
    name: cleanText(input.name, 120),
    salt: cleanText(input.salt, 160),
    brand: cleanText(input.brand, 80),
    category: input.category,
    hsn: input.hsn.replace(/\D/g, "").slice(0, 8),
    barcode: cleanCode(input.barcode, 32),
    rack: cleanCode(input.rack, 16),
    unit: input.unit,
    unitsPerStrip: Math.trunc(clamp(input.unitsPerStrip, 1, 500, 1)),
    allowLoose: loosePossible ? input.allowLoose : false,
    mrp,
    // Selling above MRP is illegal in India — cap it
    salePrice: Math.min(clamp(input.salePrice, 0, 1_000_000, 0), mrp),
    minStock: Math.trunc(clamp(input.minStock, 0, 1_000_000, 0)),
    gstPercent: isGstRate(input.gstPercent)
      ? input.gstPercent
      : DEFAULT_GST_RATE,
    status: input.status === "inactive" ? "inactive" : "active",
  };
}
