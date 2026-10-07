import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mockSuppliers } from "@medicare/demo/data/mockSuppliers";
import { buildApp } from "../app";
import { openDatabase, type Database } from "../db/client";
import { seedDemoData } from "../db/seed";

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

const valid = {
  name: "Shree Ganesh Pharma",
  gstin: "27AAPFU0939F1ZV",
  drugLicenseNo: "mh-tz2-20b-1",
  contactPerson: "Ganesh",
  phone: "9820012345",
  email: "SALES@GANESH.IN",
  address: "Bhiwandi",
  city: "Thane",
  creditDays: 30,
  status: "active",
};
const send = (
  method: "POST" | "PUT" | "DELETE",
  url: string,
  payload?: object,
) => app.inject({ method, url, payload });
const get = (url: string) => app.inject({ method: "GET", url });
const count = () =>
  (
    database.raw.prepare("SELECT count(*) n FROM suppliers").get() as {
      n: number;
    }
  ).n;

describe("suppliers API", () => {
  it("lists every supplier exactly as it went in", async () => {
    const body = (await get("/api/suppliers")).json();
    expect(body.count).toBe(mockSuppliers.length);
    const byId = (l: { id: string }[]) =>
      [...l].sort((a, b) => a.id.localeCompare(b.id));
    expect(byId(body.items)).toEqual(byId(mockSuppliers));
  });

  it("adds a supplier, cleaned by the shared rules", async () => {
    const res = await send("POST", "/api/suppliers", valid);
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      drugLicenseNo: "MH-TZ2-20B-1",
      email: "sales@ganesh.in",
      id: expect.any(String),
    });
  });

  it.each([
    ["an invalid GSTIN", { gstin: "27AAPFU0939F1ZX" }, /GSTIN/],
    [
      "a name already used (any case)",
      { name: "SHREE GANESH PHARMA", gstin: "27AABCS1234D1ZV" },
      /name already exists/,
    ],
    ["credit days as text", { creditDays: "30" }, /creditDays/],
    ["an extra field", { id: "x" }, /nrecognized/],
  ])("refuses %s", async (_l, change, msg) => {
    const before = count();
    const res = await send("POST", "/api/suppliers", { ...valid, ...change });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(msg);
    expect(count()).toBe(before);
  });

  it("refuses the same GSTIN twice", async () => {
    const res = await send("POST", "/api/suppliers", {
      ...valid,
      name: "Different name",
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/GSTIN already used/);
  });

  it("edits a supplier", async () => {
    const id = mockSuppliers[0].id;
    const res = await send("PUT", `/api/suppliers/${id}`, {
      ...valid,
      name: "Renamed Agency",
      gstin: mockSuppliers[0].gstin,
    });
    expect(res.statusCode).toBe(200);
    expect((await get(`/api/suppliers/${id}`)).json().name).toBe(
      "Renamed Agency",
    );
  });

  it("a supplier with invoices can't be deleted (409); a new one can", async () => {
    const used = database.raw
      .prepare("SELECT supplier_id id FROM purchases LIMIT 1")
      .get() as { id: string };
    expect((await send("DELETE", `/api/suppliers/${used.id}`)).statusCode).toBe(
      409,
    );
    const fresh = (
      await send("POST", "/api/suppliers", {
        ...valid,
        name: "Temp Supplier",
        gstin: "27AABCT5678E1Z4",
      })
    ).json();
    expect(
      (await send("DELETE", `/api/suppliers/${fresh.id}`)).statusCode,
    ).toBe(204);
  });

  it("the database itself refuses a duplicate GSTIN (two counters at once)", () => {
    expect(() =>
      database.raw
        .exec(`UPDATE suppliers SET gstin = (SELECT gstin FROM suppliers WHERE gstin <> '' LIMIT 1 OFFSET 1)
                         WHERE id = (SELECT id FROM suppliers WHERE gstin <> '' LIMIT 1)`),
    ).toThrow(/UNIQUE/);
  });
});
