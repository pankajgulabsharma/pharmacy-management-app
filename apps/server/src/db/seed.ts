/**
 * Puts the demo shop (3 months of history) into the database — built by
 * @medicare/demo with the real rules, so every number is consistent.
 * One transaction: all of it goes in, or nothing does.
 */
import { DEFAULT_SETTINGS } from "@medicare/domain/settings/defaults";
import { rupeesToPaise } from "@medicare/domain/lib/money";
import { mockMedicines } from "@medicare/demo/data/mockMedicines";
import { mockSuppliers } from "@medicare/demo/data/mockSuppliers";
import {
  demoCustomerPayments,
  demoCustomers,
  demoHeldBills,
  demoInventory,
  demoPurchases,
  demoReturns,
  demoSaleReturns,
  demoSales,
} from "@medicare/demo/seed";
import { hashPassword } from "../auth/password";
import type { Database } from "./client";
import * as t from "./schema";
import { insertRows, writeTx } from "./sync";
import {
  batchToRow,
  heldToRow,
  insertPurchase,
  insertPurchaseReturn,
  insertSale,
  insertSaleReturn,
  movementToRow,
} from "./mappers";

/** Demo sign-ins (username = password). A real shop starts with only "admin" — see auth/store.ts */
export const DEMO_USERS = [
  { id: "u_admin", username: "admin", name: "Pankaj Sharma", role: "owner" },
  {
    id: "u_pharmacist",
    username: "pharmacist",
    name: "Anita Verma",
    role: "pharmacist",
  },
  { id: "u_cashier", username: "cashier", name: "Ravi Kumar", role: "cashier" },
] as const;

/** Slow password hashes, made once per run (outside any transaction) */
let hashes: Promise<string[]> | null = null;
const demoHashes = () =>
  (hashes ??= Promise.all(DEMO_USERS.map((u) => hashPassword(u.username))));

/**
 * Puts the demo shop into the database in ONE transaction, using the same
 * mappers the server uses for every save — so seed and app can't disagree.
 */
export async function seedDemoData({
  raw,
}: Database): Promise<Record<string, number>> {
  const now = new Date().toISOString();
  const users = (await demoHashes()).map((passwordHash, i) => ({
    ...DEMO_USERS[i],
    passwordHash,
    createdAt: now,
  }));
  writeTx(raw, () => {
    // Accounts already made (e.g. the starter "admin") are kept as they are
    const { n } = raw.prepare("SELECT count(*) n FROM users").get() as {
      n: number;
    };
    if (n === 0) insertRows(raw, t.users, users);
    insertRows(
      raw,
      t.medicines,
      mockMedicines.map((m) => ({
        ...m,
        mrpPaise: rupeesToPaise(m.mrp),
        salePricePaise: rupeesToPaise(m.salePrice),
      })),
    );
    insertRows(raw, t.suppliers, mockSuppliers);
    insertRows(raw, t.batches, demoInventory.batches.map(batchToRow));
    insertRows(
      raw,
      t.stockMovements,
      demoInventory.movements.map(movementToRow),
    );
    for (const p of demoPurchases) insertPurchase(raw, p);
    for (const r of demoReturns) insertPurchaseReturn(raw, r);
    insertRows(raw, t.customers, demoCustomers);
    insertRows(raw, t.customerPayments, demoCustomerPayments);
    for (const sale of demoSales) insertSale(raw, sale);
    for (const r of demoSaleReturns) insertSaleReturn(raw, r);
    insertRows(raw, t.heldBills, demoHeldBills.map(heldToRow));
    insertRows(
      raw,
      t.settings,
      Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({
        key,
        valueJson: JSON.stringify(value),
        updatedAt: now,
      })),
    );
  });
  const count = (table: string) =>
    (raw.prepare(`SELECT count(*) n FROM ${table}`).get() as { n: number }).n;
  return Object.fromEntries(
    [
      "medicines",
      "suppliers",
      "batches",
      "stock_movements",
      "purchases",
      "purchase_returns",
      "customers",
      "customer_payments",
      "sales",
      "sale_lines",
      "sale_returns",
      "held_bills",
      "users",
    ].map((n) => [n, count(n)]),
  );
}

/** True when the shop already has data (never overwrite real data by accident) */
export async function hasData({ raw }: Database): Promise<boolean> {
  const r = raw
    .prepare("SELECT EXISTS (SELECT 1 FROM medicines) AS has")
    .get() as { has: number };
  return r.has === 1;
}
