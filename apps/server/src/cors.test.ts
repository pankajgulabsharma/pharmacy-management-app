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

describe("CORS — only the desktop app may call the server from a browser", () => {
  it("allows the desktop app", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/health",
      headers: { origin: "http://localhost:5173" },
    });
    expect(res.headers["access-control-allow-origin"]).toBe(
      "http://localhost:5173",
    );
  });

  it("answers the browser's pre-check (OPTIONS)", async () => {
    const res = await app.inject({
      method: "OPTIONS",
      url: "/api/medicines",
      headers: { origin: "http://localhost:5173" },
    });
    expect(res.statusCode).toBe(204);
    expect(res.headers["access-control-allow-methods"]).toContain("POST");
  });

  it("gives no permission to any other website", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/health",
      headers: { origin: "https://evil.example" },
    });
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
