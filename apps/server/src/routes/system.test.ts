import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app";
import { openDatabase, type Database } from "../db/client";
import { seedDemoData } from "../db/seed";
import { signIn } from "../test/signIn";

let dir: string;
let database: Database;
let app: ReturnType<typeof buildApp>;
let lan = false;
const switched: boolean[] = [];

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "medicare-ui-"));
  mkdirSync(join(dir, "assets"));
  writeFileSync(
    join(dir, "index.html"),
    "<!doctype html><title>MediCare</title>",
  );
  writeFileSync(join(dir, "assets", "app-1.js"), "console.log(1)");
  database = await openDatabase(":memory:");
  await seedDemoData(database);
  app = buildApp({
    database,
    appDir: dir,
    system: {
      lanEnabled: () => lan,
      setLan: async (on) => {
        lan = on;
        switched.push(on);
      },
    },
  });
});
afterAll(async () => {
  await app.close();
  database.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("the server also serves the app screens", () => {
  it("any screen address opens the app; files are served; API stays API", async () => {
    const page = await app.inject({ method: "GET", url: "/billing" });
    expect(page.statusCode).toBe(200);
    expect(page.headers["content-type"]).toContain("text/html");
    expect(page.body).toContain("MediCare");
    const js = await app.inject({ method: "GET", url: "/assets/app-1.js" });
    expect(js.headers["content-type"]).toContain("javascript");
    expect(js.headers["cache-control"]).toContain("immutable");
    expect(
      (await app.inject({ method: "GET", url: "/api/nope" })).statusCode,
    ).toBe(401);
  });

  it("never serves files from outside the app folder", async () => {
    const r = await app.inject({
      method: "GET",
      url: "/..%2f..%2fetc%2fpasswd",
    });
    expect(r.body).toContain("MediCare"); // falls back to the app, not the file
  });
});

describe("shop network sharing", () => {
  it("shows this computer's addresses; owner can switch sharing on", async () => {
    const owner = await signIn(app);
    const info = (
      await app.inject({ method: "GET", url: "/api/system", headers: owner })
    ).json();
    expect(info.lan).toEqual({ enabled: false, canChange: true });
    expect(Array.isArray(info.addresses)).toBe(true);
    const r = await app.inject({
      method: "POST",
      url: "/api/system/lan",
      headers: owner,
      payload: { enabled: true },
    });
    expect(r.statusCode).toBe(200);
    await new Promise((res) => setTimeout(res, 20));
    expect(switched).toEqual([true]);
    const cashier = await signIn(app, "cashier");
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/system/lan",
          headers: cashier,
          payload: { enabled: false },
        })
      ).statusCode,
    ).toBe(403);
  });
});
