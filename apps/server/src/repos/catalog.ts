/**
 * Reads medicines and stock from the database and returns them in the SAME
 * shape the app already uses (@medicare/domain types). The database stores
 * paise; these types use rupees — converted here, in one place.
 */
import { asc, eq, sql } from "drizzle-orm";
import { newId } from "@medicare/domain/lib/id";
import type { StockBatch } from "@medicare/domain/inventory/types";
import type { Medicine, MedicineInput } from "@medicare/domain/medicines/types";
import type { Db } from "../db/client";
import { batches, medicines } from "../db/schema";
import { InputError } from "../schemas/medicine";
import { medicineFromRow, medicineToRow } from "../db/mappers";

const rupees = (paise: number) => paise / 100;

const toMedicine = (r: typeof medicines.$inferSelect) => medicineFromRow(r);
const toRow = medicineToRow;

function toBatch(r: typeof batches.$inferSelect): StockBatch {
  const { mrpPaise, purchasePricePaise, ...rest } = r;
  return {
    ...rest,
    mrp: rupees(mrpPaise),
    purchasePrice: rupees(purchasePricePaise),
  };
}

export async function listMedicines(db: Db): Promise<Medicine[]> {
  return (await db.select().from(medicines).orderBy(asc(medicines.name))).map(
    toMedicine,
  );
}

export async function getMedicine(
  db: Db,
  id: string,
): Promise<Medicine | null> {
  const row = await db
    .select()
    .from(medicines)
    .where(eq(medicines.id, id))
    .get();
  return row ? toMedicine(row) : null;
}

export async function listBatches(db: Db): Promise<StockBatch[]> {
  return (
    await db
      .select()
      .from(batches)
      .orderBy(asc(batches.medicineId), asc(batches.expiry))
  ).map(toBatch);
}

/* ------------------------------------------------------------------ */
/* Writes                                                             */
/* ------------------------------------------------------------------ */

/** A scanned barcode must point to exactly one medicine */
async function checkBarcode(db: Db, code: string, exceptId = "") {
  if (!code) return;
  const other = await db
    .select({ id: medicines.id, name: medicines.name })
    .from(medicines)
    .where(eq(medicines.barcode, code))
    .get();
  if (other && other.id !== exceptId)
    throw new InputError(`Barcode ${code} is already used by ${other.name}`);
}

export async function createMedicine(
  db: Db,
  input: MedicineInput,
): Promise<Medicine> {
  await checkBarcode(db, input.barcode);
  const row = { id: newId("med"), ...toRow(input) };
  await db.insert(medicines).values(row);
  return toMedicine(row);
}

/** null when there is no such medicine */
export async function updateMedicine(
  db: Db,
  id: string,
  input: MedicineInput,
): Promise<Medicine | null> {
  if (!(await getMedicine(db, id))) return null;
  await checkBarcode(db, input.barcode, id);
  await db.update(medicines).set(toRow(input)).where(eq(medicines.id, id));
  return getMedicine(db, id);
}

export type DeleteResult =
  "deleted" | "not_found" | "has_stock" | "has_history";

/**
 * Only a medicine that was never stocked or sold can be deleted.
 * Otherwise its history must stay — mark it Inactive instead.
 */
export async function deleteMedicine(
  db: Db,
  id: string,
): Promise<DeleteResult> {
  if (!(await getMedicine(db, id))) return "not_found";
  const usage = await db
    .select({
      batches: sql<number>`count(*)`,
      stock: sql<number>`coalesce(sum(${batches.qtyStrip} + ${batches.qtyLoose}), 0)`,
    })
    .from(batches)
    .where(eq(batches.medicineId, id))
    .get();
  if (usage && usage.stock > 0) return "has_stock";
  if (usage && usage.batches > 0) return "has_history";
  try {
    await db.delete(medicines).where(eq(medicines.id, id));
  } catch {
    return "has_history"; // still on a bill or purchase line (foreign key)
  }
  return "deleted";
}
