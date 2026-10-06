import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { demoInventory, demoSales } from "@medicare/demo/seed";
import { openDatabase, type Database } from "./client";
import { hasData, seedDemoData } from "./seed";

let database: Database;
const q = <T>(sql: string) => database.raw.prepare(sql).get() as T;
const fails = (sql: string) => () => database.raw.exec(sql);

beforeAll(async () => {
  database = await openDatabase(":memory:");
  await seedDemoData(database);
});
afterAll(() => database.close());

describe("database setup", () => {
  it("creates every table from the migration", () => {
    const n = q<{ n: number }>(
      "SELECT count(*) n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_\\_%' ESCAPE '\\'",
    ).n;
    expect(n).toBe(19);
  });

  it("stores the whole demo shop", async () => {
    expect(await hasData(database)).toBe(true);
    expect(q<{ n: number }>("SELECT count(*) n FROM sales").n).toBe(
      demoSales.length,
    );
    expect(q<{ n: number }>("SELECT count(*) n FROM batches").n).toBe(
      demoInventory.batches.length,
    );
  });

  it("keeps money exact (paise) — total sales match the demo to the paisa", () => {
    const db = q<{ total: number }>(
      "SELECT sum(net_paise) total FROM sales",
    ).total;
    expect(db).toBe(demoSales.reduce((a, s) => a + s.totals.netPaise, 0));
  });

  it("stock on every shelf = sum of its movements (audit trail is complete)", () => {
    const bad = q<{ n: number }>(`
      SELECT count(*) n FROM batches b
      LEFT JOIN (SELECT batch_id, sum(qty_strip_delta) s, sum(qty_loose_delta) l FROM stock_movements GROUP BY batch_id) m
        ON m.batch_id = b.id
      WHERE coalesce(m.s, 0) <> b.qty_strip OR coalesce(m.l, 0) <> b.qty_loose`).n;
    expect(bad).toBe(0);
  });
});

describe("the database itself refuses impossible data", () => {
  it("stock can never go below zero", () => {
    expect(fails("UPDATE batches SET qty_strip = -1 WHERE rowid = 1")).toThrow(
      /CHECK/,
    );
  });

  it("udhaar bill without a customer account", () => {
    expect(
      fails(
        "UPDATE sales SET status = 'udhaar', customer_id = NULL WHERE rowid = 1",
      ),
    ).toThrow(/CHECK/);
  });

  it("the same bill number twice", () => {
    expect(
      fails(
        "UPDATE sales SET bill_no = (SELECT bill_no FROM sales WHERE rowid = 2) WHERE rowid = 1",
      ),
    ).toThrow(/UNIQUE/);
  });

  it("a bill line for a bill that does not exist", () => {
    expect(
      fails("UPDATE sale_lines SET sale_id = 'no-such-bill' WHERE rowid = 1"),
    ).toThrow(/FOREIGN KEY/);
  });

  it("sale price above MRP", () => {
    expect(
      fails(
        "UPDATE medicines SET sale_price_paise = mrp_paise + 1 WHERE rowid = 1",
      ),
    ).toThrow(/CHECK/);
  });

  it("two customers with the same mobile (empty mobiles are fine)", () => {
    expect(
      fails(
        "UPDATE customers SET phone = (SELECT phone FROM customers WHERE rowid = 2) WHERE rowid = 1",
      ),
    ).toThrow(/UNIQUE/);
    expect(
      fails("UPDATE customers SET phone = '' WHERE rowid IN (1, 2)"),
    ).not.toThrow();
  });
});
