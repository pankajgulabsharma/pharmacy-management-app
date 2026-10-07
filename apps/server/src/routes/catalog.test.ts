import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mockMedicines } from "@medicare/demo/data/mockMedicines";
import { demoInventory } from "@medicare/demo/seed";
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

const get = (url: string) => app.inject({ method: "GET", url });
const byId = <T extends { id: string }>(list: T[]) =>
  [...list].sort((a, b) => a.id.localeCompare(b.id));

describe("GET /api/medicines", () => {
  it("returns every medicine exactly as it went in (all fields, every rupee)", async () => {
    const body = (await get("/api/medicines")).json();
    expect(body.count).toBe(mockMedicines.length);
    expect(byId(body.items)).toEqual(byId(mockMedicines));
  });

  it("is sorted by name", async () => {
    const names = (await get("/api/medicines"))
      .json()
      .items.map((m: { name: string }) => m.name);
    expect(names).toEqual(
      [...names].sort((a: string, b: string) => a.localeCompare(b)),
    );
  });

  it("GET /api/medicines/:id → one medicine, or a 404 message", async () => {
    expect((await get(`/api/medicines/${mockMedicines[0].id}`)).json()).toEqual(
      mockMedicines[0],
    );
    const none = await get("/api/medicines/no-such-id");
    expect(none.statusCode).toBe(404);
    expect(none.json()).toEqual({ error: "Medicine not found" });
  });
});

describe("GET /api/inventory/batches", () => {
  it("returns every batch with its exact stock and prices", async () => {
    const body = (await get("/api/inventory/batches")).json();
    expect(body.count).toBe(demoInventory.batches.length);
    expect(byId(body.items)).toEqual(byId(demoInventory.batches));
  });
});

describe("errors", () => {
  it("unknown address → JSON 404", async () => {
    const res = await get("/api/nope");
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "Not found" });
  });
});
