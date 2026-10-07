import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mockMedicines } from "@medicare/demo/data/mockMedicines";
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
  name: "Azithral 500 Tablet",
  salt: "Azithromycin 500mg",
  brand: "Alembic",
  category: "tablet_capsule",
  hsn: "30042019",
  barcode: "",
  rack: "B-2",
  unit: "STP",
  unitsPerStrip: 5,
  allowLoose: true,
  mrp: 119.5,
  salePrice: 110,
  minStock: 10,
  gstPercent: 12,
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
    database.raw.prepare("SELECT count(*) n FROM medicines").get() as {
      n: number;
    }
  ).n;

describe("add a medicine", () => {
  it("saves it and returns it with a new id", async () => {
    const res = await send("POST", "/api/medicines", valid);
    expect(res.statusCode).toBe(201);
    const saved = res.json();
    expect(saved).toMatchObject({ ...valid, id: expect.any(String) });
    expect((await get(`/api/medicines/${saved.id}`)).json().mrp).toBe(119.5);
  });

  it("applies the shop's rules (sale price capped at MRP, text trimmed)", async () => {
    const saved = (
      await send("POST", "/api/medicines", {
        ...valid,
        name: "  Pan 40  ",
        salePrice: 999,
      })
    ).json();
    expect(saved.name).toBe("Pan 40");
    expect(saved.salePrice).toBe(valid.mrp);
  });

  it.each([
    ["a missing name", { ...valid, name: " " }, /Name/],
    ["an unknown category", { ...valid, category: "candy" }, /category/],
    ["MRP as text", { ...valid, mrp: "100" }, /mrp/],
    ["a zero MRP", { ...valid, mrp: 0 }, /MRP/],
    ["an illegal GST rate", { ...valid, gstPercent: 7 }, /gstPercent/],
    [
      "an extra field (sneaking in an id)",
      { ...valid, id: "hacked" },
      /nrecognized/,
    ],
  ])(
    "refuses %s with a clear message, saving nothing",
    async (_label, body, msg) => {
      const before = count();
      const res = await send("POST", "/api/medicines", body);
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatch(msg);
      expect(count()).toBe(before);
    },
  );
});

describe("edit a medicine", () => {
  it("updates it in the database", async () => {
    const id = mockMedicines[0].id;
    const res = await send("PUT", `/api/medicines/${id}`, {
      ...valid,
      name: "Renamed",
    });
    expect(res.statusCode).toBe(200);
    expect((await get(`/api/medicines/${id}`)).json().name).toBe("Renamed");
  });

  it("unknown medicine → 404", async () => {
    expect((await send("PUT", "/api/medicines/nope", valid)).statusCode).toBe(
      404,
    );
  });
});

describe("delete a medicine", () => {
  it("a never-used medicine can be deleted", async () => {
    const { id } = (await send("POST", "/api/medicines", valid)).json();
    expect((await send("DELETE", `/api/medicines/${id}`)).statusCode).toBe(204);
    expect((await get(`/api/medicines/${id}`)).statusCode).toBe(404);
  });

  it("a medicine with stock or history is kept (409 → mark Inactive)", async () => {
    const used = database.raw
      .prepare("SELECT medicine_id id FROM batches LIMIT 1")
      .get() as { id: string };
    const res = await send("DELETE", `/api/medicines/${used.id}`);
    expect(res.statusCode).toBe(409);
    expect((await get(`/api/medicines/${used.id}`)).statusCode).toBe(200);
  });
});

describe("CSV import", () => {
  it("adds every row", async () => {
    const before = count();
    const res = await send("POST", "/api/medicines/import", {
      rows: [valid, { ...valid, name: "Second" }],
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().count).toBe(2);
    expect(count()).toBe(before + 2);
  });

  it("one bad row → nothing is saved (all or nothing)", async () => {
    const before = count();
    const res = await send("POST", "/api/medicines/import", {
      rows: [valid, { ...valid, name: "" }],
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/Row 2/);
    expect(count()).toBe(before);
  });
});
