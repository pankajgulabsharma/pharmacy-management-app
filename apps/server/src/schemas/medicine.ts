/**
 * What a medicine sent to the server must look like. Two layers:
 *  1. shape (Zod) — right types, known category/unit, NO extra fields
 *     (so nobody can sneak in an "id" or anything else)
 *  2. the shop's rules (cleanMedicineInput) — same function the app uses
 */
import { z } from "zod";
import {
  MAX_MEDICINE_IMPORT,
  MEDICINE_CATEGORIES,
  PACK_UNITS,
  cleanMedicineInput,
} from "@medicare/domain/medicines/clean";
import type { MedicineInput } from "@medicare/domain/medicines/types";
import { GST_RATES, type GstRate } from "@medicare/domain/lib/gst";

const text = (max: number) => z.string().max(max);
const amount = z.number().finite().min(0).max(1_000_000);

export const medicineInputSchema = z
  .object({
    name: text(200),
    salt: text(300),
    brand: text(200),
    category: z.enum(MEDICINE_CATEGORIES),
    hsn: text(20),
    barcode: text(64),
    rack: text(32),
    unit: z.enum(PACK_UNITS),
    unitsPerStrip: z.number().int().min(1).max(500),
    allowLoose: z.boolean(),
    mrp: amount,
    salePrice: amount,
    minStock: z.number().int().min(0).max(1_000_000),
    gstPercent: z.union(
      GST_RATES.map((r) => z.literal(r)) as [
        z.ZodLiteral<GstRate>,
        ...z.ZodLiteral<GstRate>[],
      ],
    ),
    status: z.enum(["active", "inactive"]),
  })
  .strict();

const importSchema = z
  .object({ rows: z.array(z.unknown()).min(1).max(MAX_MEDICINE_IMPORT) })
  .strict();

/** Bad input from the app → the route answers 400 with this message */
export class InputError extends Error {}

/** Shape check + the shop's rules → a clean medicine, or an InputError */
export function parseMedicine(body: unknown): MedicineInput {
  const r = medicineInputSchema.safeParse(body);
  if (!r.success) throw new InputError(describe(r.error));
  const m = cleanMedicineInput(r.data);
  if (m.name.length < 2) throw new InputError("Name is required");
  if (m.mrp <= 0) throw new InputError("MRP must be more than 0");
  return m;
}

/** Every row must pass, or nothing is imported */
export function parseImport(body: unknown): MedicineInput[] {
  const r = importSchema.safeParse(body);
  if (!r.success) throw new InputError(describe(r.error));
  return r.data.rows.map((row, i) => {
    try {
      return parseMedicine(row);
    } catch (e) {
      throw new InputError(`Row ${i + 1}: ${(e as Error).message}`);
    }
  });
}

/** First problem in plain words, e.g. "mrp: Invalid input…" */
function describe(err: z.ZodError): string {
  const i = err.issues[0];
  return i ? `${i.path.join(".") || "body"}: ${i.message}` : "Invalid data";
}
