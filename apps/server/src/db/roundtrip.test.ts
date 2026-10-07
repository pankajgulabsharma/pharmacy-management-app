import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
import { openDatabase, type Database } from "./client";
import { seedDemoData } from "./seed";
import * as m from "./mappers";

let database: Database;
beforeAll(async () => {
  database = await openDatabase(":memory:");
  await seedDemoData(database);
});
afterAll(() => database.close());

/** Same set of records, ignoring list order; JSON drops `undefined` fields */
const same = <T extends { id: string }>(a: readonly T[], b: readonly T[]) => {
  const norm = (l: readonly T[]) =>
    JSON.parse(JSON.stringify([...l].sort((x, y) => x.id.localeCompare(y.id))));
  expect(norm(a)).toEqual(norm(b));
};

describe("what goes into the database comes back exactly the same", () => {
  it("sales — every line, every batch allocation, every paisa", () =>
    same(m.loadSales(database.raw), demoSales));
  it("sales returns", () =>
    same(m.loadSaleReturns(database.raw), demoSaleReturns));
  it("purchases with lines and totals (incl. a cancelled one)", () =>
    same(m.loadPurchases(database.raw), demoPurchases));
  it("debit notes", () =>
    same(m.loadPurchaseReturns(database.raw), demoReturns));
  it("stock batches and their movement history", () => {
    same(m.loadBatches(database.raw), demoInventory.batches);
    same(m.loadMovements(database.raw), demoInventory.movements);
  });
  it("customers, payments and held bills", () => {
    same(m.loadCustomers(database.raw), demoCustomers);
    same(m.loadCustomerPayments(database.raw), demoCustomerPayments);
    same(m.loadHeld(database.raw), demoHeldBills);
  });
  it("a filtered load returns only those bills, complete", () => {
    const one = demoSales.find((s) => s.lines.length > 1)!;
    expect(
      JSON.parse(JSON.stringify(m.loadSales(database.raw, "id = ?", [one.id]))),
    ).toEqual(JSON.parse(JSON.stringify([one])));
  });
});
