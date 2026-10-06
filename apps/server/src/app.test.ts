import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app";
import { openDatabase, type Database } from "./db/client";

let database: Database;
let app: ReturnType<typeof buildApp>;
beforeAll(async () => {
  database = await openDatabase(":memory:");
  app = buildApp({ database });
});
afterAll(async () => {
  await app.close();
  database.close();
});

describe("server", () => {
  it("GET /health says the server and the database are up", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      ok: true,
      service: "medicare-server",
      db: "ok",
    });
  });

  it("unknown address → 404", async () => {
    const res = await app.inject({ method: "GET", url: "/nope" });
    expect(res.statusCode).toBe(404);
  });
});
