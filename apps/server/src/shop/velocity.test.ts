import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { demoSales, demoSaleReturns } from "@medicare/demo/seed";
import { buildApp } from "../app";
import { openDatabase, type Database } from "../db/client";
import { seedDemoData } from "../db/seed";
import { signIn } from "../test/signIn";
import { salesVelocity } from "./velocity";

let database: Database;
let app: ReturnType<typeof buildApp>;
beforeAll(async () => {
  database = await openDatabase(":memory:");
  await seedDemoData(database);
  app = buildApp({ database });
});
afterAll(async () => {
  await app.close();
  database.close();
});

const packs = (l: {
  unit: string;
  unitsPerStrip: number;
  qtyStrip: number;
  qtyLoose: number;
}) =>
  l.unit === "LSE"
    ? l.qtyLoose
    : l.qtyStrip + l.qtyLoose / Math.max(1, l.unitsPerStrip);

describe("how fast each medicine sells", () => {
  it("= packs on bills in the window − customer returns; last sale over all bills", () => {
    const now = new Date();
    const since = new Date(now.getTime() - 60 * 86_400_000).toISOString();
    const r = salesVelocity(database.raw, 60, now);

    // Worked out again from the demo data itself
    const want = new Map<string, { last: string; packs: number }>();
    for (const s of demoSales)
      for (const l of s.lines) {
        const w = want.get(l.medicineId) ?? { last: "", packs: 0 };
        if (s.createdAt > w.last) w.last = s.createdAt;
        if (s.createdAt >= since) w.packs += packs(l);
        want.set(l.medicineId, w);
      }
    for (const ret of demoSaleReturns) {
      if (ret.createdAt < since) continue;
      for (const l of ret.lines) {
        const w = want.get(l.medicineId);
        if (w) w.packs -= packs(l);
      }
    }
    expect(r.items.length).toBe(want.size);
    for (const v of r.items) {
      const w = want.get(v.medicineId)!;
      expect(v.lastSoldAt).toBe(w.last);
      expect(v.soldPacks).toBeCloseTo(Math.max(0, w.packs), 6);
    }
  });

  it("is a report: owner yes, cashier no", async () => {
    const get = async (user: "admin" | "cashier") =>
      (
        await app.inject({
          method: "GET",
          url: "/api/reports/velocity?days=30",
          headers: await signIn(app, user),
        })
      ).statusCode;
    expect(await get("admin")).toBe(200);
    expect(await get("cashier")).toBe(403);
  });
});
