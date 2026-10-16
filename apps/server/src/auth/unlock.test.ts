import { generateKeyPairSync, sign } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app";
import { openDatabase, type Database } from "../db/client";
import { seedDemoData } from "../db/seed";
import { unlockMessage } from "./unlock";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const pem = publicKey.export({ type: "spki", format: "pem" }).toString();
const MACHINE = "AAAA-BBBB-CCCC-DDDD";
/** What `npm run license -- unlock` makes */
const unlockCode = (machine: string, request: string) =>
  `MU1.${sign(null, Buffer.from(unlockMessage(machine, request)), privateKey).toString("base64url")}`;

let database: Database;
let app: ReturnType<typeof buildApp>;
beforeAll(async () => {
  database = await openDatabase(":memory:");
  await seedDemoData(database);
  app = buildApp({
    database,
    license: { enforce: false, publicKey: pem, machine: MACHINE },
  });
});
afterAll(async () => {
  await app.close();
  database.close();
});

const unlock = (code: string, userId = "u_admin") =>
  app.inject({
    method: "POST",
    url: "/api/auth/unlock",
    payload: { userId, code, password: "fresh@123" },
  });

describe("forgot password and no recovery code: provider's unlock code", () => {
  it("only the code made for THIS computer and THIS request works, once", async () => {
    const r1 = (
      await app.inject({ method: "GET", url: "/api/auth/unlock-request" })
    ).json();
    expect(r1.machine).toBe(MACHINE);
    expect(r1.request).toMatch(/^\d{6}$/);
    // asking again → the same request (until used or 24 h)
    expect(
      (
        await app.inject({ method: "GET", url: "/api/auth/unlock-request" })
      ).json().request,
    ).toBe(r1.request);

    expect(
      (await unlock(unlockCode("ZZZZ-BBBB-CCCC-DDDD", r1.request))).statusCode,
    ).toBe(400);
    expect((await unlock(unlockCode(MACHINE, "000000"))).statusCode).toBe(400);
    expect((await unlock("MU1.made-up")).statusCode).toBe(400);
    const good = unlockCode(MACHINE, r1.request);
    expect((await unlock(good, "u_cashier")).statusCode).toBe(400);
    expect((await unlock(good)).statusCode).toBe(200);
    // the new password works; the code can't be used again
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "admin", password: "fresh@123" },
    });
    expect(login.statusCode).toBe(200);
    expect((await unlock(good)).statusCode).toBe(400);
  });
});
