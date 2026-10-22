import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app";
import { openDatabase, type Database } from "../db/client";
import { seedDemoData } from "../db/seed";
import { signIn } from "../test/signIn";

let database: Database;
let app: ReturnType<typeof buildApp>;
let owner: Record<string, string>;
let cashier: Record<string, string>;

beforeAll(async () => {
  database = await openDatabase(":memory:");
  await seedDemoData(database);
  app = buildApp({ database });
  owner = await signIn(app);
  cashier = await signIn(app, "cashier");
});
afterAll(async () => {
  await app.close();
  database.close();
});

const call = (
  method: "GET" | "POST" | "PUT",
  url: string,
  h: object,
  payload?: object,
) => app.inject({ method, url, headers: h as never, payload });

type Line = {
  batchId: string;
  medicineId: string;
  systemStrip: number;
  systemLoose: number;
};
const batch = (id: string) =>
  database.raw
    .prepare("SELECT qty_strip s, qty_loose l FROM batches WHERE id = ?")
    .get(id) as { s: number; l: number };

describe("stock count", () => {
  it("lists racks; staff without stock rights can't start one", async () => {
    const r = (await call("GET", "/api/stock-counts", owner)).json();
    expect(r.racks).toContain("A1");
    expect(r.counts).toEqual([]);
    expect(
      (await call("POST", "/api/stock-counts", cashier, { racks: ["A1"] }))
        .statusCode,
    ).toBe(403);
  });

  it("snapshot → count → bills in between don't spoil it → post", async () => {
    const start = await call("POST", "/api/stock-counts", owner, {
      racks: ["A1", "B2"],
      note: "Monthly",
    });
    expect(start.statusCode).toBe(201);
    const { count, lines } = start.json() as {
      count: { id: string; countNo: string };
      lines: Line[];
    };
    expect(count.countNo).toBe("SC-0001");
    expect(lines.length).toBeGreaterThan(1);

    // Only one open count at a time
    expect(
      (await call("POST", "/api/stock-counts", owner, { racks: [] }))
        .statusCode,
    ).toBe(400);

    // Two batches with a few strips on the shelf
    const [a, b] = lines.filter((l) => l.systemStrip >= 2);
    // a: one strip short; b: matches
    await call("PUT", `/api/stock-counts/${count.id}/lines`, owner, {
      lines: [
        {
          batchId: a.batchId,
          qtyStrip: a.systemStrip - 1,
          qtyLoose: a.systemLoose,
        },
        {
          batchId: b.batchId,
          qtyStrip: b.systemStrip,
          qtyLoose: b.systemLoose,
        },
      ],
    });
    // A strip of `a` is sold after it was counted
    database.raw
      .prepare("UPDATE batches SET qty_strip = qty_strip - 1 WHERE id = ?")
      .run(a.batchId);

    const posted = await call(
      "POST",
      `/api/stock-counts/${count.id}/post`,
      owner,
    );
    expect(posted.statusCode).toBe(200);
    expect(posted.json().count).toMatchObject({
      status: "posted",
      summary: { counted: 2, matched: 1, short: 1, excess: 0 },
    });
    // snapshot − 1 sold − 1 short
    expect(batch(a.batchId).s).toBe(a.systemStrip - 2);
    expect(batch(b.batchId).s).toBe(b.systemStrip);
    const mv = database.raw
      .prepare(
        "SELECT note AS reason FROM stock_movements WHERE batch_id = ? AND type = 'adjustment'",
      )
      .all(a.batchId) as { reason: string }[];
    expect(mv.map((m) => m.reason)).toContain("Stock count SC-0001");

    // Posted counts are closed for typing
    expect(
      (
        await call("PUT", `/api/stock-counts/${count.id}/lines`, owner, {
          lines: [{ batchId: a.batchId, qtyStrip: 0, qtyLoose: 0 }],
        })
      ).statusCode,
    ).toBe(400);
  });

  it("cancel leaves stock alone; nothing counted can't be posted", async () => {
    const { count } = (
      await call("POST", "/api/stock-counts", owner, { racks: ["C1"] })
    ).json();
    expect(count.countNo).toBe("SC-0002");
    expect(
      (await call("POST", `/api/stock-counts/${count.id}/post`, owner))
        .statusCode,
    ).toBe(400);
    const c = await call("POST", `/api/stock-counts/${count.id}/cancel`, owner);
    expect(c.json().count.status).toBe("cancelled");
    expect(
      (await call("POST", "/api/stock-counts", owner, { racks: ["NOPE"] }))
        .statusCode,
    ).toBe(400);
  });
});
