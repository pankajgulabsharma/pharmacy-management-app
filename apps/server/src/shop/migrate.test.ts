import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app";
import { openDatabase, type Database } from "../db/client";
import { seedDemoData } from "../db/seed";
import { signIn } from "../test/signIn";

let database: Database;
let app: ReturnType<typeof buildApp>;
let auth: { authorization: string };
beforeAll(async () => {
  database = await openDatabase(":memory:");
  await seedDemoData(database);
  app = buildApp({ database });
  auth = await signIn(app);
});
afterAll(async () => {
  await app.close();
  database.close();
});
const call = (method: "GET" | "POST", url: string, payload?: unknown) =>
  app.inject({ method, url, headers: auth, payload: payload as object });

describe("switching from other software", () => {
  it("customers come with their old udhaar; a second run doubles nothing", async () => {
    const rows = [
      {
        name: "Ramesh Patil",
        phone: "9812345670",
        address: "Thane",
        creditLimitPaise: 0,
        openingBalancePaise: 1_250_00,
        notes: "",
      },
      {
        name: "X",
        phone: "",
        address: "",
        creditLimitPaise: 0,
        notes: "",
      },
    ];
    const r = (await call("POST", "/api/customers/import", { rows })).json();
    expect(r.result).toMatchObject({
      created: 1,
      existing: 0,
      openingPaise: 1_250_00,
      errors: [{ row: 3, error: "Name is required" }],
    });
    const again = (
      await call("POST", "/api/customers/import", { rows })
    ).json();
    expect(again.result).toMatchObject({ created: 0, existing: 1 });
    // The old udhaar can be paid off like any udhaar
    const id = r.patch.customers[0].id;
    const pay = await call("POST", "/api/customer-payments", {
      customerId: id,
      amount: "1250",
      method: "cash",
      reference: "",
      note: "",
    });
    expect(pay.statusCode).toBe(201);
  });

  it("suppliers come with old dues: payable, but not a purchase, no stock, no GST", async () => {
    const r = (
      await call("POST", "/api/suppliers/import", {
        rows: [
          {
            name: "Mahavir Pharma Distributors",
            gstin: "27AAPFU0939F1ZV",
            drugLicenseNo: "MH-TZ1-20B-1",
            contactPerson: "",
            phone: "9820011122",
            email: "",
            address: "",
            city: "Thane",
            creditDays: 30,
            openingDuePaise: 48_500_00,
          },
        ],
      })
    ).json();
    expect(r.result.errors).toEqual([]);
    expect(r.result).toMatchObject({ created: 1, openingPaise: 48_500_00 });
    const due = r.patch.purchases[0];
    expect(due).toMatchObject({
      invoiceNo: "OPENING",
      stockPosted: false,
      lines: [],
      totals: { netPaise: 48_500_00, gstPaise: 0 },
    });
    // pay part of it
    const paid = await call("POST", `/api/purchases/${due.id}/payments`, {
      amountPaise: 10_000_00,
    });
    expect([200, 201]).toContain(paid.statusCode);
    // can't be edited or returned
    const ret = await call("POST", "/api/purchase-returns", {
      purchaseId: due.id,
      reason: "damaged",
      lines: [],
      notes: "",
    });
    expect(ret.statusCode).toBe(400);
  });

  it("one supplier's old balance with the old bill no.", async () => {
    const sup = (await call("GET", "/api/suppliers")).json().items[0];
    const r = await call("POST", `/api/suppliers/${sup.id}/opening`, {
      amountPaise: 5_000_00,
      date: "2026-03-31",
      ref: "OLD/123",
    });
    expect(r.statusCode).toBe(201);
    expect(r.json().purchase).toMatchObject({
      invoiceNo: "OLD/123",
      invoiceDate: "2026-03-31",
    });
    const again = await call("POST", `/api/suppliers/${sup.id}/opening`, {
      amountPaise: 5_000_00,
      ref: "OLD/123",
    });
    expect(again.statusCode).toBe(400);
  });
});
