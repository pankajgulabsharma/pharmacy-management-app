import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app";
import { openDatabase, type Database } from "../db/client";
import { seedDemoData } from "../db/seed";
import { signIn } from "../test/signIn";

let database: Database;
let app: ReturnType<typeof buildApp>;
let owner: { authorization: string };
beforeAll(async () => {
  database = await openDatabase(":memory:");
  await seedDemoData(database);
  app = buildApp({ database });
  owner = await signIn(app);
});
afterAll(async () => {
  await app.close();
  database.close();
});

const call = (
  method: "GET" | "POST" | "PUT" | "DELETE",
  url: string,
  h: object = owner,
  payload?: object,
) => app.inject({ method, url, headers: h as never, payload });

describe("doctor referrals & staff commission", () => {
  it("owner only — not even the pharmacist sees the rates", async () => {
    const ph = await signIn(app, "pharmacist");
    expect((await call("GET", "/api/commission", ph)).statusCode).toBe(403);
    expect(
      (await call("PUT", "/api/commission/rates", ph, {})).statusCode,
    ).toBe(403);
  });

  it("rates saved cleaned; payouts recorded and undone", async () => {
    expect((await call("GET", "/api/commission")).json()).toEqual({
      rates: { basis: "sales", doctors: {}, staff: {} },
      payouts: [],
    });
    const r = await call("PUT", "/api/commission/rates", owner, {
      basis: "profit",
      doctors: { " Dr. Kavita Shah ": 10, "Dr. Zero": 0 },
      staff: { "Ravi Kumar": 1.5 },
    });
    expect(r.json().rates).toEqual({
      basis: "profit",
      doctors: { "Dr. Kavita Shah": 10 },
      staff: { "Ravi Kumar": 1.5 },
    });
    const bad = await call("POST", "/api/commission/payouts", owner, {
      kind: "doctor",
      name: "Dr. Kavita Shah",
      from: "2026-10-31",
      to: "2026-10-01",
      amountPaise: 500_00,
    });
    expect(bad.statusCode).toBe(400);
    const ok = await call("POST", "/api/commission/payouts", owner, {
      kind: "doctor",
      name: "Dr. Kavita Shah",
      from: "2026-10-01",
      to: "2026-10-31",
      amountPaise: 500_00,
      note: "Cash",
    });
    expect(ok.statusCode).toBe(201);
    const { payouts } = (await call("GET", "/api/commission")).json();
    expect(payouts).toMatchObject([
      { name: "Dr. Kavita Shah", amountPaise: 500_00, note: "Cash" },
    ]);
    expect(
      (await call("DELETE", `/api/commission/payouts/${payouts[0].id}`))
        .statusCode,
    ).toBe(200);
    expect((await call("GET", "/api/commission")).json().payouts).toEqual([]);
  });
});
