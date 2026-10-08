import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mockMedicines } from "@medicare/demo/data/mockMedicines";
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
) => app.inject({ method, url, payload, headers: auth });
const get = (url: string) => app.inject({ method: "GET", url, headers: auth });
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

describe("import from a file (Excel / Marg / Tally)", () => {
  const stockOf = (name: string) =>
    database.raw
      .prepare(
        "SELECT b.batch_no, b.expiry, b.qty_strip FROM batches b JOIN medicines m ON m.id = b.medicine_id WHERE m.name = ? ORDER BY b.batch_no",
      )
      .all(name);

  it("adds medicines and their opening stock; same name = same medicine", async () => {
    const before = count();
    const opening = (batchNo: string, qty: number) => ({
      batchNo,
      expiry: "12/28",
      qty,
      mrp: valid.mrp,
      purchasePrice: 20,
    });
    const res = await send("POST", "/api/medicines/import", {
      rows: [
        {
          medicine: { ...valid, name: "Imported Tab" },
          opening: opening("IM1", 10),
        },
        {
          medicine: { ...valid, name: "IMPORTED TAB" },
          opening: opening("IM2", 4),
        },
        { medicine: { ...valid, name: "Second" } },
      ],
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ created: 2, batches: 2 });
    expect(count()).toBe(before + 2);
    expect(stockOf("Imported Tab")).toEqual([
      { batch_no: "IM1", expiry: "12/28", qty_strip: 10 },
      { batch_no: "IM2", expiry: "12/28", qty_strip: 4 },
    ]);
    // Opening stock is explained in the stock history
    const mv = database.raw
      .prepare(
        "SELECT count(*) n FROM stock_movements WHERE type = 'opening' AND ref_id LIKE 'import_%'",
      )
      .get() as { n: number };
    expect(mv.n).toBe(2);
    // Importing the same file again reuses the medicines (no duplicates)
    const again = await send("POST", "/api/medicines/import", {
      rows: [{ medicine: { ...valid, name: "Imported Tab" } }],
    });
    expect(again.json()).toMatchObject({ created: 0, existing: 1 });
  });

  it("one bad row → nothing is saved (all or nothing)", async () => {
    const before = count();
    const res = await send("POST", "/api/medicines/import", {
      rows: [
        { medicine: valid },
        {
          medicine: { ...valid, name: "Bad stock" },
          opening: {
            batchNo: "B1",
            expiry: "13/99",
            qty: 5,
            mrp: 30,
            purchasePrice: 20,
          },
        },
      ],
    });
    expect(res.statusCode).toBe(400);
    expect(count()).toBe(before);
  });
});

describe("barcodes", () => {
  it("one barcode → one medicine (add, edit and import all check it)", async () => {
    const a = (
      await send("POST", "/api/medicines", {
        ...valid,
        name: "Cotton Roll 50g",
        barcode: "2123456789012",
      })
    ).json();
    const dup = await send("POST", "/api/medicines", {
      ...valid,
      name: "Other",
      barcode: "2123456789012",
    });
    expect(dup.statusCode).toBe(400);
    expect(dup.json().error).toMatch(/already used by Cotton Roll 50g/);
    // Saving the same medicine again with its own barcode is fine
    expect(
      (
        await send("PUT", `/api/medicines/${a.id}`, {
          ...valid,
          name: "Cotton Roll 50g",
          barcode: "2123456789012",
        })
      ).statusCode,
    ).toBe(200);
    // Import: rows with the same barcode are the same medicine
    const imp = await send("POST", "/api/medicines/import", {
      rows: [
        { medicine: { ...valid, name: "X1", barcode: "2999999999990" } },
        { medicine: { ...valid, name: "X2", barcode: "2999999999990" } },
      ],
    });
    expect(imp.json()).toMatchObject({ created: 1 });
  });
});
