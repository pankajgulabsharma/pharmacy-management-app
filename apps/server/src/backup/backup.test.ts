import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { gunzipSync } from "node:zlib";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app";
import { openDatabase, type Database } from "../db/client";
import { seedDemoData } from "../db/seed";
import { EventBus } from "../events";
import { signIn } from "../test/signIn";
import { catchUpOffsite } from "./offsite";
import { kindOf } from "./places";
import {
  KEEP_AUTO,
  createBackup,
  listBackups,
  startAutoBackup,
} from "./backup";

const lic = { enforce: false, publicKey: "", machine: "TEST-MACHINE" };
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
  app = buildApp({
    database,
    bus,
    backupDir: join(dir, "backups"),
    license: lic,
  });
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
    expect(backup.name).toMatch(/^medicare-\d{8}-\d{6}-manual\.sqlite\.gz$/);
    expect(backup.sizeBytes).toBeGreaterThan(10_000);
    expect((await call("GET", "/api/backups")).json().backups[0].name).toBe(
      backup.name,
    );
    const dl = await call("GET", `/api/backups/${backup.name}/download`);
    expect(dl.statusCode).toBe(200);
    // Zipped: much smaller, and a real database inside
    expect(gunzipSync(dl.rawPayload).subarray(0, 15).toString()).toBe(
      "SQLite format 3",
    );
    expect(dl.rawPayload.length).toBeLessThan(
      gunzipSync(dl.rawPayload).length / 2,
    );
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
    // An old unzipped .sqlite backup is accepted too
    const plain = await app.inject({
      method: "POST",
      url: "/api/backups/upload",
      headers: { ...owner, "content-type": "application/octet-stream" },
      payload: gunzipSync(bytes),
    });
    expect(plain.statusCode).toBe(201);
    const r = await call(
      "POST",
      `/api/backups/${plain.json().backup.name}/restore`,
    );
    expect(r.statusCode).toBe(200);
  });

  it("second copy in a Google Drive / pen drive folder, with licence details", async () => {
    const drive = join(dir, "My Drive");
    const put = (folder: string) =>
      app.inject({
        method: "PUT",
        url: "/api/backups/offsite",
        headers: owner,
        payload: { folder },
      });
    expect((await put("relative/path")).statusCode).toBe(400);
    // a drive that isn't plugged in is never created on this disk
    expect((await put(drive)).statusCode).toBe(400);
    expect(existsSync(drive)).toBe(false);
    mkdirSync(drive);
    const r = await put(drive);
    expect(r.statusCode).toBe(200);
    const { offsite } = r.json();
    expect(offsite.target).toContain(join("My Drive", "MediCare Backups"));
    expect(offsite.lastError).toBeNull();
    expect(offsite).toMatchObject({ connected: true, kind: "local" });
    // the newest backup was copied right away, with the licence details
    const files = readdirSync(offsite.target);
    expect(files.some((f) => f.endsWith(".sqlite.gz"))).toBe(true);
    const info = readFileSync(join(offsite.target, "LICENCE-INFO.txt"), "utf8");
    expect(info).toMatch(/Machine code:/);
    expect(info).toMatch(/Shop:/);
    // Backup now → copied too
    const { backup, offsite: after } = (
      await call("POST", "/api/backups")
    ).json();
    expect(existsSync(join(after.target, backup.name))).toBe(true);
    // Pen drive pulled out → recorded, the backup itself still made
    rmSync(drive, { recursive: true, force: true });
    const blocked = join(dir, "blocked");
    writeFileSync(blocked, "a file, not a folder");
    database.raw
      .prepare(
        "UPDATE settings SET value_json = ? WHERE key = 'backup_offsite'",
      )
      .run(JSON.stringify({ folder: blocked }));
    const again = (await call("POST", "/api/backups")).json();
    expect(again.backup.name).toMatch(/manual/);
    expect(again.offsite.lastError).toMatch(/not found/);
    expect(again.offsite.connected).toBe(false);
    expect(
      existsSync(blocked) && !readdirSync(dir).includes("MediCare Backups"),
    ).toBe(true);
    // switched off
    expect((await put("")).json().offsite.folder).toBe("");
  });

  it("pen drive plugged back in → the missed copy goes out by itself", async () => {
    const pen = join(dir, "PEN");
    mkdirSync(pen);
    const put = (folder: string) =>
      app.inject({
        method: "PUT",
        url: "/api/backups/offsite",
        headers: owner,
        payload: { folder },
      });
    const { offsite } = (await put(pen)).json();
    // pulled out; a backup is made meanwhile
    rmSync(pen, { recursive: true, force: true });
    const { backup } = (await call("POST", "/api/backups")).json();
    expect(catchUpOffsite(database.raw, join(dir, "backups"), lic)).toBe(false);
    expect(existsSync(pen)).toBe(false);
    // back in → copied; nothing more to do after that
    mkdirSync(pen);
    expect(catchUpOffsite(database.raw, join(dir, "backups"), lic)).toBe(true);
    expect(existsSync(join(offsite.target, backup.name))).toBe(true);
    expect(catchUpOffsite(database.raw, join(dir, "backups"), lic)).toBe(false);
    const health = (await call("GET", "/api/backups/health")).json();
    expect(health.offsite).toMatchObject({ connected: true, lastError: null });
    expect(health.lastBackupAt).toBeTruthy();
    await put("");
  });

  it("folder picker lists folders only; screen shows the data's size", async () => {
    mkdirSync(join(dir, "pick", "B Folder"), { recursive: true });
    mkdirSync(join(dir, "pick", "a folder"));
    mkdirSync(join(dir, "pick", ".hidden"));
    writeFileSync(join(dir, "pick", "file.txt"), "x");
    const r = await call(
      "GET",
      `/api/backups/browse?path=${encodeURIComponent(join(dir, "pick"))}`,
    );
    expect(r.json()).toEqual({
      path: join(dir, "pick"),
      parent: dir,
      folders: ["a folder", "B Folder"],
    });
    expect((await call("GET", "/api/backups/browse?path=rel")).statusCode).toBe(
      400,
    );
    const missing = await call(
      "GET",
      `/api/backups/browse?path=${encodeURIComponent(join(dir, "nope"))}`,
    );
    expect(missing.json().error).toMatch(/connected/);
    const all = (await call("GET", "/api/backups")).json();
    expect(all.places.at(-1)).toMatchObject({ kind: "local" });
    expect(all.data.counts.medicines).toBeGreaterThan(10);
    expect(all.data.sizeBytes).toBeGreaterThan(0);
  });

  it("first start of a new financial year keeps a year-end copy for ever", async () => {
    const d = join(dir, "yearend");
    // a bill from last financial year exists
    database.raw
      .prepare(
        "UPDATE sales SET created_at = '2020-01-15T10:00:00.000Z' WHERE id = (SELECT id FROM sales LIMIT 1)",
      )
      .run();
    const stop = startAutoBackup(database.raw, d);
    await stop.first;
    stop();
    const kinds = listBackups(d)
      .map((b) => b.kind)
      .sort();
    expect(kinds).toEqual(["auto", "year-end"]);
    // only once a year
    const again = startAutoBackup(database.raw, d);
    await again.first;
    again();
    expect(listBackups(d).filter((b) => b.kind === "year-end")).toHaveLength(1);
  });

  it("development: only the last 10 days of backups are kept", async () => {
    const d = join(dir, "dev10");
    mkdirSync(d, { recursive: true });
    const old = join(d, "medicare-20200101-100000-manual.sqlite.gz");
    writeFileSync(old, "x");
    utimesSync(old, new Date("2020-01-01"), new Date("2020-01-01"));
    const stop = startAutoBackup(database.raw, d, undefined, 10);
    await stop.first;
    stop();
    const kinds = listBackups(d).map((b) => b.kind);
    expect(kinds).toContain("auto");
    expect(kinds).not.toContain("manual"); // the 2020 one is gone
  });

  it("automatic: one a day, only the last 30 kept", async () => {
    const d = join(dir, "auto");
    const stop = startAutoBackup(database.raw, d);
    await stop.first;
    stop();
    expect(listBackups(d).filter((b) => b.kind === "auto")).toHaveLength(1);
    // Many days of automatic backups → oldest are removed, manual ones stay
    await createBackup(
      database.raw,
      d,
      "manual",
      new Date("2020-01-01T00:00:00Z"),
    );
    for (let i = 0; i < KEEP_AUTO + 3; i++)
      await createBackup(
        database.raw,
        d,
        "auto",
        new Date(Date.UTC(2021, 0, 1 + i)),
      );
    const all = listBackups(d);
    expect(all.filter((b) => b.kind === "auto")).toHaveLength(KEEP_AUTO);
    expect(all.filter((b) => b.kind === "manual")).toHaveLength(1);
  });
});

describe("where a folder is", () => {
  const known = [
    { label: "Google Drive", path: "/x/My Drive", kind: "cloud" as const },
    { label: "PEN", path: "/media/u/PEN", kind: "drive" as const },
  ];
  it("cloud / pen drive / this computer", () => {
    expect(kindOf("/x/My Drive/Shop", known)).toBe("cloud");
    expect(kindOf("/media/u/PEN", known)).toBe("drive");
    expect(kindOf("/media/u/PENNY", known)).toBe("local");
    expect(kindOf("/home/u/Documents", known)).toBe("local");
  });
});
