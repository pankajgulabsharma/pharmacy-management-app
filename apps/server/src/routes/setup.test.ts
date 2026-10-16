import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app";
import { openDatabase, type Database } from "../db/client";
import { ensureOwner } from "../auth/store";

let database: Database;
let app: ReturnType<typeof buildApp>;
beforeAll(async () => {
  database = await openDatabase(":memory:");
  await ensureOwner(database.raw); // what a brand-new install has
  app = buildApp({ database });
});
afterAll(async () => {
  await app.close();
  database.close();
});

const shop = {
  name: "Sharma Medical",
  phone: "9820012345",
  address: "Shop 2, Station Road, Pune",
  drugLicense: "MH-PZ-123456",
  gstin: "",
};
const post = (payload: object) =>
  app.inject({ method: "POST", url: "/api/setup", payload });

describe("first start: one screen and go", () => {
  it("a new shop is asked to set up instead of showing the tiles", async () => {
    const r = (
      await app.inject({ method: "GET", url: "/api/auth/people" })
    ).json();
    expect(r.setup).toBe(true);
  });

  it("checks the shop details and the password", async () => {
    const noLicence = await post({
      shop: { ...shop, drugLicense: "" },
      owner: { name: "Rakesh Sharma", password: "shop@2026" },
    });
    expect(noLicence.json().error).toMatch(/Drug licence/);
    const weak = await post({
      shop,
      owner: { name: "Rakesh Sharma", password: "admin" },
    });
    expect(weak.statusCode).toBe(400);
  });

  it("saves shop + owner, signs in, gives a recovery code — once only", async () => {
    const r = await post({
      shop,
      owner: { name: "Rakesh Sharma", password: "shop@2026" },
    });
    expect(r.statusCode).toBe(201);
    const { token, user, recoveryCode } = r.json();
    expect(user).toMatchObject({
      name: "Rakesh Sharma",
      role: "owner",
      mustChangePassword: false,
    });
    expect(recoveryCode).toMatch(/^\w{4}-\w{4}-\w{4}$/);
    const me = await app.inject({
      method: "GET",
      url: "/api/settings",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(me.json().settings.shop).toMatchObject({ name: "Sharma Medical" });
    const people = (
      await app.inject({ method: "GET", url: "/api/auth/people" })
    ).json();
    expect(people).toMatchObject({ shop: "Sharma Medical", setup: false });
    expect(people.people[0]).toMatchObject({
      name: "Rakesh Sharma",
      method: "password",
    });
    // never again
    expect(
      (
        await post({ shop, owner: { name: "X Y", password: "hacker99" } })
      ).json().error,
    ).toMatch(/already set up/);
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "admin", password: "shop@2026" },
    });
    expect(login.statusCode).toBe(200);
  });
});
