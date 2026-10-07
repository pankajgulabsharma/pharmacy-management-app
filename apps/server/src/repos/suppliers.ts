/** Suppliers in the database ↔ the app's Supplier type */
import { asc, eq, sql } from "drizzle-orm";
import { newId } from "@medicare/domain/lib/id";
import { assertUniqueSupplier } from "@medicare/domain/suppliers/clean";
import type { Supplier, SupplierInput } from "@medicare/domain/suppliers/types";
import type { Db } from "../db/client";
import { purchaseReturns, purchases, suppliers } from "../db/schema";

export async function listSuppliers(db: Db): Promise<Supplier[]> {
  return db.select().from(suppliers).orderBy(asc(suppliers.name));
}

export async function getSupplier(
  db: Db,
  id: string,
): Promise<Supplier | null> {
  return (
    (await db.select().from(suppliers).where(eq(suppliers.id, id)).get()) ??
    null
  );
}

/** Same uniqueness rule as the app (friendly message before the DB index) */
async function checkUnique(db: Db, input: SupplierInput, exceptId?: string) {
  const others = await db
    .select({ id: suppliers.id, name: suppliers.name, gstin: suppliers.gstin })
    .from(suppliers);
  assertUniqueSupplier(others, input, exceptId);
}

export async function createSupplier(
  db: Db,
  input: SupplierInput,
): Promise<Supplier> {
  await checkUnique(db, input);
  const row: Supplier = {
    id: newId("sup"),
    ...input,
    createdAt: new Date().toISOString(),
  };
  await db.insert(suppliers).values(row);
  return row;
}

/** null when there is no such supplier */
export async function updateSupplier(
  db: Db,
  id: string,
  input: SupplierInput,
): Promise<Supplier | null> {
  if (!(await getSupplier(db, id))) return null;
  await checkUnique(db, input, id);
  await db.update(suppliers).set(input).where(eq(suppliers.id, id));
  return getSupplier(db, id);
}

/** A supplier with invoices or debit notes is kept (mark Inactive instead) */
export async function deleteSupplier(
  db: Db,
  id: string,
): Promise<"deleted" | "not_found" | "has_invoices"> {
  if (!(await getSupplier(db, id))) return "not_found";
  const used = await db
    .select({
      n: sql<number>`(SELECT count(*) FROM ${purchases} WHERE ${purchases.supplierId} = ${id}) + (SELECT count(*) FROM ${purchaseReturns} WHERE ${purchaseReturns.supplierId} = ${id})`,
    })
    .from(suppliers)
    .where(eq(suppliers.id, id))
    .get();
  if (used && used.n > 0) return "has_invoices";
  await db.delete(suppliers).where(eq(suppliers.id, id));
  return "deleted";
}
