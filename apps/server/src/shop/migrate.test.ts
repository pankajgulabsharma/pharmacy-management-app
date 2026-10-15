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

describe("undo a customer / supplier import (a wrong file)", () => {
  const cust = (name: string, phone: string, openingBalancePaise = 0) => ({
    name,
    phone,
    address: "",
    creditLimitPaise: 0,
    openingBalancePaise,
    notes: "",
  });
  const sup = (name: string, gstin: string, openingDuePaise = 0) => ({
    name,
    gstin,
    drugLicenseNo: "",
    contactPerson: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    creditDays: 30,
    openingDuePaise,
  });
  const count = (table: string) =>
    (
      database.raw.prepare(`SELECT count(*) n FROM ${table}`).get() as {
        n: number;
      }
    ).n;

  it("customers: the new ones go (with their old udhaar); the ones already here stay", async () => {
    const before = count("customers");
    const r = (
      await call("POST", "/api/customers/import", {
        rows: [
          cust("Wrong One", "9811100001", 500_00),
          cust("Wrong Two", "9811100002"),
          // already in the demo shop → skipped, never removed by undo
          cust("Ramesh Sharma", "9820011223"),
        ],
      })
    ).json();
    expect(r.result).toMatchObject({ created: 2, existing: 1 });
    expect(count("customers")).toBe(before + 2);
    const list = (await call("GET", "/api/customers/imports")).json().imports;
    expect(list[0]).toMatchObject({
      id: r.result.importId,
      created: 2,
      openingPaise: 500_00,
      undoneAt: "",
    });

    const undo = await call(
      "POST",
      `/api/customers/imports/${r.result.importId}/undo`,
    );
    expect(undo.statusCode).toBe(200);
    expect(undo.json().patch.customersRemoved).toHaveLength(2);
    expect(count("customers")).toBe(before);
    expect(
      (
        await call("POST", `/api/customers/imports/${r.result.importId}/undo`)
      ).json().error,
    ).toMatch(/already undone/);
  });

  it("customers: refused once one has a payment — nothing changes", async () => {
    const r = (
      await call("POST", "/api/customers/import", {
        rows: [cust("Paid Already", "9811100003", 300_00)],
      })
    ).json();
    const id = r.patch.customers[0].id;
    await call("POST", "/api/customer-payments", {
      customerId: id,
      amount: "100",
      method: "cash",
      reference: "",
      note: "",
    });
    const before = count("customers");
    const undo = await call(
      "POST",
      `/api/customers/imports/${r.result.importId}/undo`,
    );
    expect(undo.statusCode).toBe(400);
    expect(undo.json().error).toMatch(/Paid Already already used/);
    expect(count("customers")).toBe(before);
  });

  it("suppliers: the new ones and their old dues go", async () => {
    const before = [count("suppliers"), count("purchases")];
    const r = (
      await call("POST", "/api/suppliers/import", {
        rows: [
          sup("Wrong Supplier A", "27AABCW1234A1ZX", 12_000_00),
          sup("Wrong Supplier B", "27AABCP5678B1ZE"),
        ],
      })
    ).json();
    expect(r.result).toMatchObject({ created: 2, openingPaise: 12_000_00 });
    expect(count("purchases")).toBe(before[1] + 1);
    const undo = await call(
      "POST",
      `/api/suppliers/imports/${r.result.importId}/undo`,
    );
    expect(undo.statusCode).toBe(200);
    expect(undo.json().patch.purchasesRemoved).toHaveLength(1);
    expect([count("suppliers"), count("purchases")]).toEqual(before);
  });

  it("suppliers: refused once an old due is paid — nothing changes", async () => {
    const r = (
      await call("POST", "/api/suppliers/import", {
        rows: [sup("Paid Supplier", "27AABCQ9012C1ZR", 9_000_00)],
      })
    ).json();
    const due = r.patch.purchases[0];
    await call("POST", `/api/purchases/${due.id}/payments`, {
      amountPaise: 1_000_00,
    });
    const before = [count("suppliers"), count("purchases")];
    const undo = await call(
      "POST",
      `/api/suppliers/imports/${r.result.importId}/undo`,
    );
    expect(undo.statusCode).toBe(400);
    expect(undo.json().error).toMatch(/Paid Supplier already used/);
    expect([count("suppliers"), count("purchases")]).toEqual(before);
  });

  it("a customer import can't be undone as a supplier one", async () => {
    const r = (
      await call("POST", "/api/customers/import", {
        rows: [cust("Kind Check", "9811100009")],
      })
    ).json();
    const wrong = await call(
      "POST",
      `/api/suppliers/imports/${r.result.importId}/undo`,
    );
    expect(wrong.statusCode).toBe(404);
  });
});
