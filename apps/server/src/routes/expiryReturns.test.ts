import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  expiryItems,
  groupBySupplier,
} from "@medicare/domain/purchases/expiryReturns";
import { buildApp } from "../app";
import { openDatabase, type Database } from "../db/client";
import * as m from "../db/mappers";
import { seedDemoData } from "../db/seed";
import { signIn } from "../test/signIn";

let database: Database;
let app: ReturnType<typeof buildApp>;
let owner: Record<string, string>;
let cashier: Record<string, string>;

beforeAll(async () => {
  database = await openDatabase(":memory:");
  await seedDemoData(database);
  app = buildApp({ database });
  owner = await signIn(app);
  cashier = await signIn(app, "cashier");
});
afterAll(async () => {
  await app.close();
  database.close();
});

const items = () => {
  const raw = database.raw;
  return expiryItems(
    m.loadBatches(raw),
    m.loadMedicinesSync(raw),
    m.loadPurchases(raw),
    m.loadPurchaseReturns(raw),
    { nearDays: 90 },
  );
};
const post = (h: object, payload: object) =>
  app.inject({
    method: "POST",
    url: "/api/purchase-returns/expiry",
    headers: h as never,
    payload,
  });
const today = new Date().toISOString().slice(0, 10);

describe("expiry return", () => {
  it("demo shop has short-dated stock traced to suppliers", () => {
    const { groups } = groupBySupplier(items());
    expect(groups.length).toBeGreaterThan(0);
    expect(groups[0].creditPaise).toBeGreaterThan(0);
  });

  it("returns a supplier's short-dated stock: a debit note per invoice, stock and dues go down", async () => {
    const g = groupBySupplier(items()).groups[0];
    const pick = g.items.map((i) => ({
      purchaseId: i.source!.purchaseId,
      purchaseLineId: i.source!.purchaseLineId,
      qty: i.packs,
    }));
    const batchQty = (id: string) =>
      database.raw
        .prepare("SELECT qty_strip s, qty_loose l FROM batches WHERE id = ?")
        .get(id) as { s: number; l: number };
    const before = g.items.map((i) => batchQty(i.batchId));

    // Cashier can't; another supplier's invoice is refused
    expect(
      (
        await post(cashier, {
          supplierId: g.supplierId,
          date: today,
          reason: "near_expiry",
          notes: "",
          items: pick,
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await post(owner, {
          supplierId: "s_other",
          date: today,
          reason: "near_expiry",
          notes: "",
          items: pick,
        })
      ).statusCode,
    ).toBe(400);

    const r = await post(owner, {
      supplierId: g.supplierId,
      date: today,
      reason: "near_expiry",
      notes: "Month-end expiry return",
      items: pick,
    });
    expect(r.statusCode).toBe(201);
    const { returns } = r.json();
    expect(returns).toHaveLength(g.invoices);
    expect(returns[0].returnNo).toMatch(/^DN\//);
    const total = returns.reduce(
      (a: number, x: { totalPaise: number }) => a + x.totalPaise,
      0,
    );
    expect(total).toBe(g.creditPaise);

    g.items.forEach((i, n) => {
      const after = batchQty(i.batchId);
      const lse = i.unit === "LSE";
      expect(lse ? after.l : after.s).toBe(
        (lse ? before[n].l : before[n].s) - i.packs,
      );
    });
    // It no longer shows up for that supplier
    expect(
      groupBySupplier(items()).groups.find(
        (x) => x.supplierId === g.supplierId,
      ),
    ).toBeUndefined();

    // Same again: nothing left to return
    expect(
      (
        await post(owner, {
          supplierId: g.supplierId,
          date: today,
          reason: "near_expiry",
          notes: "",
          items: pick,
        })
      ).statusCode,
    ).toBe(400);
  });
});
