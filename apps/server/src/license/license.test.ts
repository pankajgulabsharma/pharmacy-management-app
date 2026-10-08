import { generateKeyPairSync, sign } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../app";
import { openDatabase, type Database } from "../db/client";
import { seedDemoData } from "../db/seed";
import { signIn } from "../test/signIn";
import type { LicenseData } from "./key";
import { licenseState, type LicenseOptions } from "./state";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const PUB = publicKey.export({ type: "spki", format: "pem" }).toString();
const MACHINE = "TEST-MACH-INE0-0001";
const DAY = 86_400_000;

/** Same as `npm run license -- issue` */
function makeKey(over: Partial<LicenseData> = {}, key = privateKey) {
  const data: LicenseData = {
    v: 1,
    id: "LIC-TEST",
    shop: "Sharma Medicals",
    machine: MACHINE,
    issuedAt: "2026-10-01",
    expiresAt: "2027-09-30",
    counters: 2,
    ...over,
  };
  const body = `MC1.${Buffer.from(JSON.stringify(data)).toString("base64url")}`;
  return `${body}.${sign(null, Buffer.from(body), key).toString("base64url")}`;
}

let now = new Date("2026-10-08T10:00:00");
const opts: LicenseOptions = {
  enforce: true,
  publicKey: PUB,
  machine: MACHINE,
  now: () => now,
};
let database: Database;
let app: ReturnType<typeof buildApp>;
let owner: { authorization: string };

beforeEach(async () => {
  await app?.close();
  database?.close();
  now = new Date("2026-10-08T10:00:00");
  database = await openDatabase(":memory:");
  await seedDemoData(database);
  app = buildApp({ database, license: opts });
  owner = await signIn(app);
});
afterAll(async () => {
  await app.close();
  database.close();
});

const activate = (key: string, h = owner) =>
  app.inject({
    method: "POST",
    url: "/api/license",
    headers: h,
    payload: { key },
  });
const status = async () =>
  (
    await app.inject({ method: "GET", url: "/api/license", headers: owner })
  ).json();
const sell = () =>
  app.inject({
    method: "POST",
    url: "/api/sales",
    headers: owner,
    payload: {},
  });

describe("licence", () => {
  it("new install: 14-day trial, then ON HOLD — but data stays readable", async () => {
    expect(await status()).toMatchObject({
      status: "trial",
      daysLeft: 14,
      canWork: true,
    });
    now = new Date(now.getTime() + 15 * DAY);
    const s = await status();
    expect(s).toMatchObject({ status: "expired", canWork: false });
    const r = await sell();
    expect(r.statusCode).toBe(402);
    expect(r.json().error).toMatch(/on hold/);
    // Looking, reports and backups still work
    expect(
      (await app.inject({ method: "GET", url: "/api/sales", headers: owner }))
        .statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/backups",
          headers: owner,
        })
      ).statusCode,
    ).toBe(201);
  });

  it("a valid key for THIS computer unlocks it; warns 15 days before the end", async () => {
    now = new Date(now.getTime() + 20 * DAY); // trial over
    const r = await activate(makeKey());
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({
      status: "active",
      canWork: true,
      counters: 2,
      license: { shop: "Sharma Medicals", expiresAt: "2027-09-30" },
    });
    expect((await sell()).statusCode).toBe(400); // allowed → reaches the bill rules
    now = new Date("2027-09-20T10:00:00");
    expect((await status()).message).toMatch(/ends in 11 days/);
  });

  it("after the last day: 7 days grace, then on hold until a new key", async () => {
    await activate(makeKey());
    now = new Date("2027-10-03T10:00:00");
    expect(await status()).toMatchObject({
      status: "grace",
      canWork: true,
      daysLeft: 5,
    });
    now = new Date("2027-10-08T10:00:00");
    expect(await status()).toMatchObject({ status: "expired", canWork: false });
    expect(
      (await activate(makeKey({ expiresAt: "2028-09-30" }))).json().status,
    ).toBe("active");
  });

  it("refuses made-up, edited, other-computer and wrong-signer keys", async () => {
    const good = makeKey();
    const [h, , s] = good.split(".");
    const edited = `${h}.${Buffer.from(JSON.stringify({ v: 1, id: "X", shop: "Sharma Medicals", machine: MACHINE, issuedAt: "2026-10-01", expiresAt: "2099-12-31", counters: 99 })).toString("base64url")}.${s}`;
    expect((await activate(edited)).json().error).toMatch(/not valid/);
    expect(
      (await activate(makeKey({ machine: "OTHR-COMP-UTER-0000" }))).json()
        .error,
    ).toMatch(/different computer/);
    const other = generateKeyPairSync("ed25519").privateKey;
    expect((await activate(makeKey({}, other))).json().error).toMatch(
      /not valid/,
    );
    expect((await activate("hello-this-is-not-a-key")).json().error).toMatch(
      /not a MediCare licence key/,
    );
  });

  it("only the owner enters keys (cashier can't), even on hold", async () => {
    const cashier = await signIn(app, "cashier");
    expect((await activate(makeKey(), cashier)).statusCode).toBe(403);
  });

  it("moving the computer's date back puts it on hold", async () => {
    await activate(makeKey());
    expect((await status()).status).toBe("active");
    now = new Date(now.getTime() - 3 * DAY);
    const s = await status();
    expect(s.status).toBe("clock");
    expect((await sell()).statusCode).toBe(402);
  });

  it("limits how many computers bill at once", async () => {
    await activate(makeKey({ counters: 2 })); // main computer + 1 counter
    const login = (ip: string) =>
      app.inject({
        method: "POST",
        url: "/api/auth/login",
        remoteAddress: ip,
        payload: { username: "cashier", password: "cashier" },
      });
    expect((await login("192.168.1.11")).statusCode).toBe(200);
    expect((await login("192.168.1.11")).statusCode).toBe(200); // same counter again
    const third = await login("192.168.1.12");
    expect(third.statusCode).toBe(403);
    expect(third.json().error).toMatch(/allows 2 computers/);
  });

  it("is off in development (no enforcement)", () => {
    expect(
      licenseState(database.raw, { ...opts, enforce: false }),
    ).toMatchObject({ status: "off", canWork: true });
  });
});
