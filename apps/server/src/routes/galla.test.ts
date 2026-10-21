import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { businessDate } from "@medicare/domain/cash/galla";
import { buildApp } from "../app";
import { openDatabase, type Database } from "../db/client";
import { seedDemoData } from "../db/seed";
import { signIn } from "../test/signIn";

let database: Database;
let app: ReturnType<typeof buildApp>;
let owner: Record<string, string>;
let cashier: Record<string, string>;
const today = businessDate();
const tomorrow = businessDate(new Date(Date.now() + 86_400_000));
// This computer is "Counter 2" (development = Multi-counter: one galla per counter)
const at2 = { "x-counter": "Counter%202" };

beforeAll(async () => {
  database = await openDatabase(":memory:");
  await seedDemoData(database);
  app = buildApp({ database });
  owner = { ...(await signIn(app)), ...at2 };
  cashier = { ...(await signIn(app, "cashier")), ...at2 };
});
afterAll(async () => {
  await app.close();
  database.close();
});

const call = (
  method: "GET" | "POST" | "DELETE",
  url: string,
  h: object,
  payload?: object,
) => app.inject({ method, url, headers: h as never, payload });

describe("galla / day close", () => {
  it("open → cash in/out (typed and automatic) → count → close → tomorrow's opening", async () => {
    const v0 = (await call("GET", "/api/galla", cashier)).json();
    expect(v0.counter).toBe("Counter 2");
    expect(v0.perCounter).toBe(true);
    expect(v0.day).toBeNull();

    const opened = (
      await call("POST", "/api/galla/open", cashier, {
        date: today,
        openingPaise: 2000_00,
      })
    ).json();
    expect(opened.day).toMatchObject({
      status: "open",
      openingPaise: 2000_00,
      openedBy: expect.any(String),
    });

    // A tea bill out of the drawer; a made-up category is refused
    expect(
      (
        await call("POST", "/api/galla/entries", cashier, {
          date: today,
          kind: "out",
          category: "Lottery",
          amountPaise: 50_00,
        })
      ).statusCode,
    ).toBe(400);
    const afterTea = (
      await call("POST", "/api/galla/entries", cashier, {
        date: today,
        kind: "out",
        category: "Shop expense",
        amountPaise: 60_00,
        note: "Tea",
      })
    ).json();
    expect(afterTea.summary.otherOutPaise).toBe(60_00);

    // Udhaar paid back in cash at this counter lands in its galla by itself
    const debtor = database.raw
      .prepare(
        "SELECT customer_id id FROM sales WHERE status = 'udhaar' LIMIT 1",
      )
      .get() as { id: string };
    const paid = await call("POST", "/api/customer-payments", cashier, {
      customerId: debtor.id,
      amount: "100",
      method: "cash",
      reference: "",
      note: "",
    });
    expect(paid.statusCode).toBe(201);
    const v = (await call("GET", "/api/galla", cashier)).json();
    expect(v.summary.udhaarCollectedPaise).toBe(100_00);
    expect(v.entries.map((e: { source: string }) => e.source)).toEqual([
      "manual",
      "udhaar",
    ]);
    const s = v.summary;
    expect(s.expectedPaise).toBe(s.openingPaise + s.inPaise - s.outPaise);

    // Written entries are the audit trail — not removable
    const auto = v.entries.find(
      (e: { source: string }) => e.source === "udhaar",
    );
    expect(
      (await call("DELETE", `/api/galla/entries/${auto.id}`, owner)).statusCode,
    ).toBe(400);

    // Count: ₹50 short; keep ₹1,500 for tomorrow
    const closed = (
      await call("POST", "/api/galla/close", cashier, {
        date: today,
        countedPaise: s.expectedPaise - 50_00,
        keptPaise: 1500_00,
        denominations: { "500": 3, coins: 0 },
      })
    ).json();
    expect(closed.day).toMatchObject({
      status: "closed",
      expectedPaise: s.expectedPaise,
      countedPaise: s.expectedPaise - 50_00,
      keptPaise: 1500_00,
      denominations: { "500": 3 },
    });
    expect(
      (
        await call("POST", "/api/galla/entries", cashier, {
          date: today,
          kind: "in",
          category: "Other income",
          amountPaise: 10_00,
        })
      ).json().error,
    ).toMatch(/closed/);
    const next = (
      await call("GET", `/api/galla?date=${tomorrow}`, cashier)
    ).json();
    expect(next.suggestedOpeningPaise).toBe(1500_00);

    // Only the owner reopens a day and sees the history
    const id = closed.day.id;
    expect(
      (await call("POST", `/api/galla/days/${id}/reopen`, cashier)).statusCode,
    ).toBe(403);
    expect(
      (
        await call(
          "GET",
          `/api/galla/history?from=${today}&to=${today}`,
          cashier,
        )
      ).statusCode,
    ).toBe(403);
    const hist = (
      await call("GET", `/api/galla/history?from=${today}&to=${today}`, owner)
    ).json();
    expect(hist.days).toHaveLength(1);
    const re = (
      await call("POST", `/api/galla/days/${id}/reopen`, owner)
    ).json();
    expect(re.day.status).toBe("open");
  });

  it("each counter has its own galla; an unknown counter falls back to the default", async () => {
    const c1 = (
      await call("GET", "/api/galla", { ...owner, "x-counter": "Counter%201" })
    ).json();
    expect(c1.counter).toBe("Counter 1");
    expect(c1.day).toBeNull();
    const odd = (
      await call("GET", "/api/galla", { ...owner, "x-counter": "Back%20room" })
    ).json();
    expect(odd.counter).toBe("Counter 1");
  });
});

describe("sign-in history", () => {
  it("records who signed in and closes the row on sign-out; owner only", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: at2,
      payload: { username: "pharmacist", password: "pharmacist" },
    });
    const ph = { authorization: `Bearer ${res.json().token}` };
    expect(
      (await call("GET", `/api/signins?from=${today}&to=${today}`, ph))
        .statusCode,
    ).toBe(403);
    await call("POST", "/api/auth/logout", ph);
    const list = (
      await call("GET", `/api/signins?from=${today}&to=${today}`, owner)
    ).json();
    expect(list.enabled).toBe(true);
    const mine = list.items.find(
      (r: { role: string }) => r.role === "pharmacist",
    );
    expect(mine).toMatchObject({
      counter: "Counter 2",
      computer: "",
      method: "password",
      reason: "signed_out",
      signedOutAt: expect.any(String),
    });
    const still = list.items.find((r: { role: string }) => r.role === "owner");
    expect(still).toMatchObject({ reason: "", signedOutAt: null });
  });
});
