import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mockMedicines } from "@medicare/demo/data/mockMedicines";
import type { Sale, SaleReturn } from "@medicare/domain/billing/types";
import type { StockBatch } from "@medicare/domain/inventory/types";
import { buildApp } from "../app";
import { openDatabase, type Database } from "../db/client";
import { seedDemoData } from "../db/seed";
import { signIn } from "../test/signIn";

let database: Database;
let app: ReturnType<typeof buildApp>;
let owner: Record<string, string>;

beforeAll(async () => {
  database = await openDatabase(":memory:");
  await seedDemoData(database);
  app = buildApp({ database });
  owner = await signIn(app);
});
afterAll(async () => {
  await app.close();
  database.close();
});

const call = (method: "GET" | "POST" | "PUT", url: string, payload?: object) =>
  app.inject({ method, url, headers: owner as never, payload });

const points = async (): Promise<Record<string, number>> =>
  (await call("GET", "/api/customers")).json().points;

async function bill(
  customerId: string | null,
  redeemPoints?: number,
  strips = 3,
) {
  const otc = new Set(
    mockMedicines.filter((m) => !m.schedule).map((m) => m.id),
  );
  const batches: StockBatch[] = (await call("GET", "/api/stock")).json()
    .batches;
  const b = batches
    .filter(
      (x) =>
        x.qtyStrip >= strips &&
        x.expiry.endsWith("/28") &&
        otc.has(x.medicineId),
    )
    .sort((a, c) => c.mrp - a.mrp)[0];
  return call("POST", "/api/sales", {
    cart: [
      {
        lineId: "c1",
        medicineId: b.medicineId,
        qtyStrip: strips,
        qtyLoose: 0,
        discountPercent: 0,
      },
    ],
    customerName: "Points customer",
    customerId,
    doctor: "",
    counter: "Counter 1",
    payment: {
      method: "cash",
      received: "",
      reference: "",
      split: { cash: "", upi: "", card: "" },
    },
    ...(redeemPoints ? { redeemPoints } : {}),
  });
}

describe("loyalty points", () => {
  it("demo customers have points; a walk-in earns none", async () => {
    const p = await points();
    expect(Object.values(p).some((n) => n >= 20)).toBe(true);
    const walkIn: Sale = (await bill(null)).json().sale;
    expect(walkIn.pointsEarned).toBeUndefined();
    expect((await bill(null, 20)).statusCode).toBe(400);
  });

  it("earn on a bill, use on the next, return gives back / takes back", async () => {
    const before = await points();
    const [cid, bal] = Object.entries(before).sort((a, b) => b[1] - a[1])[0];

    // Too many points → refused
    const tooMany = await bill(cid, bal + 1);
    expect(tooMany.statusCode).toBe(400);

    const use = 20;
    const res = await bill(cid, use);
    expect(res.json()).toMatchObject({ sale: {} });
    const { sale, patch } = res.json() as {
      sale: Sale;
      patch: { points: Record<string, number> };
    };
    expect(sale.pointsRedeemed).toBe(use);
    expect(sale.totals.pointsPaise).toBe(use * 100);
    // Points come off the total; GST on the lines unchanged
    expect(sale.totals.netPaise + use * 100).toBeGreaterThan(
      sale.totals.netPaise,
    );
    expect(sale.pointsEarned).toBe(Math.floor(sale.totals.netPaise / 100_00));
    const after = bal - use + (sale.pointsEarned ?? 0);
    expect(sale.pointsBalance).toBe(after);
    expect(patch.points[cid]).toBe(after);
    expect((await points())[cid]).toBe(after);

    // Whole bill back: money back = what was paid in money; points reversed
    const ret = await call("POST", "/api/sale-returns", {
      saleId: sale.id,
      reason: "Customer request",
      refundMode: "cash",
      notes: "",
      lines: sale.lines.map((l) => ({
        saleLineId: l.id,
        qtyStrip: l.qtyStrip,
        qtyLoose: l.qtyLoose,
      })),
    });
    expect(ret.json()).toMatchObject({ ret: {} });
    const r: SaleReturn = ret.json().ret;
    expect(r.refundPaise).toBe(sale.totals.netPaise);
    expect(r.pointsRestored).toBe(use);
    expect(r.pointsReversed).toBe(sale.pointsEarned);
    expect((await points())[cid]).toBe(bal);
  });
});
