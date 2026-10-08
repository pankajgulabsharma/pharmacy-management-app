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

const log = async (q = "") =>
  (
    await app.inject({
      method: "GET",
      url: `/api/audit?q=${encodeURIComponent(q)}`,
      headers: owner,
    })
  ).json().entries as { userName: string; action: string; detail: string }[];

describe("activity log", () => {
  it("records sign-ins and wrong passwords (with the name typed)", async () => {
    await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "cashier", password: "nope" },
    });
    const e = await log();
    expect(e[0]).toMatchObject({
      userName: "cashier",
      action: "Wrong password",
    });
    expect(
      e.some((x) => x.action === "Signed in" && x.userName === "Pankaj Sharma"),
    ).toBe(true);
  });

  it("every change is logged with who and what — automatically", async () => {
    const cashier = await signIn(app, "cashier");
    const batch = database.raw
      .prepare("SELECT id, batch_no FROM batches WHERE qty_strip > 5 LIMIT 1")
      .get() as { id: string; batch_no: string };
    await app.inject({
      method: "POST",
      url: "/api/stock/adjust",
      headers: owner,
      payload: { batchId: batch.id, qtyStrip: 3, qtyLoose: 0, reason: "Count" },
    });
    // A cashier trying something not allowed is logged too
    await app.inject({
      method: "PUT",
      url: "/api/settings",
      headers: cashier,
      payload: {},
    });
    const e = await log();
    expect(e[0]).toMatchObject({
      userName: "Ravi Kumar",
      action: "Refused: Shop settings changed",
    });
    expect(e[1]).toMatchObject({
      userName: "Pankaj Sharma",
      action: "Stock adjusted",
    });
    expect(e[1].detail).toContain(batch.batch_no);
    // Search
    expect(
      (await log("refused")).every((x) => x.action.startsWith("Refused")),
    ).toBe(true);
  });

  it("only the owner can read it", async () => {
    const cashier = await signIn(app, "cashier");
    const r = await app.inject({
      method: "GET",
      url: "/api/audit",
      headers: cashier,
    });
    expect(r.statusCode).toBe(403);
  });
});
