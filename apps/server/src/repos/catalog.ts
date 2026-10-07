/**
 * Reads medicines and stock from the database and returns them in the SAME
 * shape the app already uses (@medicare/domain types). The database stores
 * paise; these types use rupees — converted here, in one place.
 */
import { asc, eq } from "drizzle-orm";
import type { StockBatch } from "@medicare/domain/inventory/types";
import type { Medicine } from "@medicare/domain/medicines/types";
import type { Db } from "../db/client";
import { batches, medicines } from "../db/schema";

const rupees = (paise: number) => paise / 100;

function toMedicine(r: typeof medicines.$inferSelect): Medicine {
  const { mrpPaise, salePricePaise, ...rest } = r;
  return {
    ...rest,
    mrp: rupees(mrpPaise),
    salePrice: rupees(salePricePaise),
  } as Medicine;
}

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
