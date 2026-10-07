import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app";
import { openDatabase, type Database } from "../db/client";
import { seedDemoData } from "../db/seed";
import { EventBus } from "../events";
import { signIn } from "../test/signIn";
import {
  KEEP_AUTO,
  createBackup,
  listBackups,
  startAutoBackup,
} from "./backup";

let dir: string;
let database: Database;
let app: ReturnType<typeof buildApp>;
let owner: { authorization: string };
const events: string[] = [];

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "medicare-backup-"));
  database = await openDatabase(":memory:");
  await seedDemoData(database);
  const bus = new EventBus();
  bus.emit = (t) => void events.push(t);
  app = buildApp({ database, bus, backupDir: join(dir, "backups") });
  owner = await signIn(app);
});
afterAll(async () => {
  await app.close();
  database.close();
  rmSync(dir, { recursive: true, force: true });
});

const call = (method: "GET" | "POST", url: string, h = owner) =>
  app.inject({ method, url, headers: h });
const count = (t: string) =>
  (database.raw.prepare(`SELECT count(*) n FROM ${t}`).get() as { n: number })
    .n;

describe("backup & restore", () => {
  it("backup now → a full copy you can list and download (owner only)", async () => {
    const r = await call("POST", "/api/backups");
    expect(r.statusCode).toBe(201);
    const { backup } = r.json();
    expect(backup.name).toMatch(/^medicare-\d{8}-\d{6}-manual\.sqlite$/);
    expect(backup.sizeBytes).toBeGreaterThan(10_000);
    expect((await call("GET", "/api/backups")).json().backups[0].name).toBe(
      backup.name,
    );
    const dl = await call("GET", `/api/backups/${backup.name}/download`);
    expect(dl.statusCode).toBe(200);
    expect(dl.rawPayload.subarray(0, 15).toString()).toBe("SQLite format 3");
    // Cashier and pharmacist: no access at all
    const cashier = await signIn(app, "cashier");
    expect((await call("GET", "/api/backups", cashier)).statusCode).toBe(403);
    expect((await call("POST", "/api/backups", cashier)).statusCode).toBe(403);
  });

  it("restore brings back the data exactly as it was (and can be undone)", async () => {
    const { backup } = (await call("POST", "/api/backups")).json();
    const bills = count("sales");
    // Something goes wrong after the backup: bills deleted by mistake
    database.raw.exec("PRAGMA foreign_keys = OFF");
    database.raw.exec(
      "DELETE FROM sale_allocations; DELETE FROM sale_lines; DELETE FROM sale_return_batches; DELETE FROM sale_return_lines; DELETE FROM sale_returns; DELETE FROM sales;",
    );
    database.raw.exec("PRAGMA foreign_keys = ON");
    expect(count("sales")).toBe(0);

    const r = await call("POST", `/api/backups/${backup.name}/restore`);
    expect(r.statusCode).toBe(200);
    expect(count("sales")).toBe(bills);
    expect(events).toContain("all"); // every counter reloads
    // The state just before the restore was kept as a safety copy
    expect(r.json().safety.kind).toBe("before-restore");
    // Still signed in after the restore
    expect((await call("GET", "/api/backups")).statusCode).toBe(200);
  });

  it("refuses odd names and files that aren't MediCare backups", async () => {
    expect(
      (await call("POST", "/api/backups/..%2F..%2Fetc%2Fpasswd/restore"))
        .statusCode,
    ).toBe(400);
    const junk = await app.inject({
      method: "POST",
      url: "/api/backups/upload",
      headers: { ...owner, "content-type": "application/octet-stream" },
      payload: Buffer.from("not a database"),
    });
    expect(junk.statusCode).toBe(400);
    expect(junk.json().error).toMatch(/not a MediCare backup/);
  });

  it("a backup from a pen drive can be uploaded and restored", async () => {
    const { backup } = (await call("POST", "/api/backups")).json();
    const bytes = readFileSync(join(dir, "backups", backup.name));
    const up = await app.inject({
      method: "POST",
      url: "/api/backups/upload",
      headers: { ...owner, "content-type": "application/octet-stream" },
      payload: bytes,
    });
    expect(up.statusCode).toBe(201);
    expect(up.json().backup.kind).toBe("uploaded");
  });

  it("automatic: one a day, only the last 30 kept", async () => {
    const d = join(dir, "auto");
    const stop = startAutoBackup(database.raw, d);
    stop();
    expect(listBackups(d).filter((b) => b.kind === "auto")).toHaveLength(1);
    // Many days of automatic backups → oldest are removed, manual ones stay
    createBackup(database.raw, d, "manual", new Date("2020-01-01T00:00:00Z"));
    for (let i = 0; i < KEEP_AUTO + 3; i++)
      createBackup(database.raw, d, "auto", new Date(Date.UTC(2021, 0, 1 + i)));
    const all = listBackups(d);
    expect(all.filter((b) => b.kind === "auto")).toHaveLength(KEEP_AUTO);
    expect(all.filter((b) => b.kind === "manual")).toHaveLength(1);
  });
});
