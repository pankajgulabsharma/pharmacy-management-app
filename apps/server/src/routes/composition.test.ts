import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mockMedicines } from "@medicare/demo/data/mockMedicines";
import { DEMO_SETTINGS } from "@medicare/domain/settings/defaults";
import { receiptHtml } from "@medicare/domain/printing/receipt";
import type { Sale } from "@medicare/domain/billing/types";
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

async function bill(customerGstin?: string) {
  const otc = new Set(
    mockMedicines.filter((m) => !m.schedule).map((m) => m.id),
  );
  const batches: StockBatch[] = (await call("GET", "/api/stock")).json()
    .batches;
  const b = batches.find(
    (x) => x.qtyStrip >= 1 && x.expiry.endsWith("/28") && otc.has(x.medicineId),
  )!;
  return call("POST", "/api/sales", {
    cart: [
      {
        lineId: "c1",
        medicineId: b.medicineId,
        qtyStrip: 1,
        qtyLoose: 0,
        discountPercent: 0,
      },
    ],
    customerName: customerGstin ? "City Clinic" : "Walk-in customer",
    doctor: "",
    counter: "Counter 1",
    payment: {
      method: "cash",
      received: "",
      reference: "",
      split: { cash: "", upi: "", card: "" },
    },
    ...(customerGstin ? { customerGstin } : {}),
  });
}

/** A GSTIN with its real check digit */
function withCheck(first14: string) {
  const cs = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const v = cs.indexOf(first14[i]) * (i % 2 ? 2 : 1);
    sum += Math.floor(v / 36) + (v % 36);
  }
  return first14 + cs[(36 - (sum % 36)) % 36];
}

describe("GST composition scheme", () => {
  it("a regular shop's bill carries GST", async () => {
    const sale: Sale = (await bill()).json().sale;
    expect(sale.billOfSupply).toBeUndefined();
    expect(sale.totals.gstPaise).toBeGreaterThan(0);
  });

  it("composition: Bill of Supply, no GST, same price; stays so after switching back", async () => {
    const regular: Sale = (await bill()).json().sale;
    const r = await call("PUT", "/api/settings", {
      shop: { ...DEMO_SETTINGS.shop, gstScheme: "composition" },
    });
    expect(r.statusCode).toBe(200);
    const sale: Sale = (await bill()).json().sale;
    expect(sale.billOfSupply).toBe(true);
    expect(sale.totals.gstPaise).toBe(0);
    expect(sale.totals.taxablePaise).toBe(
      sale.totals.grossPaise - sale.totals.discountPaise,
    );
    expect(sale.lines[0].gstPercent).toBe(0);
    // The customer pays the same
    expect(sale.totals.netPaise).toBe(regular.totals.netPaise);

    const html = receiptHtml({
      sale,
      shop: DEMO_SETTINGS.shop,
      footer: "",
      format: "a4",
    });
    expect(html).toContain("BILL OF SUPPLY");
    expect(html).toContain("Composition taxable person");
    expect(html).not.toContain("CGST");

    // Another state's buyer is refused
    const far = await bill(withCheck("29AAACB1234F1Z"));
    expect(far.statusCode).toBe(400);
    expect(far.json().error).toMatch(/another state/);

    // Back to regular: the old bill is still a bill of supply
    await call("PUT", "/api/settings", {
      shop: { ...DEMO_SETTINGS.shop, gstScheme: "regular" },
    });
    const sales: Sale[] = (await call("GET", "/api/sales")).json().sales;
    expect(sales.find((x) => x.id === sale.id)!.billOfSupply).toBe(true);
  });

  it("composition needs a GSTIN", async () => {
    const r = await call("PUT", "/api/settings", {
      shop: { ...DEMO_SETTINGS.shop, gstin: "", gstScheme: "composition" },
    });
    expect(r.statusCode).toBe(400);
  });
});
