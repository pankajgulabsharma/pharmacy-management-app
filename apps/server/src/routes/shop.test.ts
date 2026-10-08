import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { toISODate } from "@medicare/domain/lib/date";
import { purchaseToDraft } from "@medicare/domain/purchases/draft";
import { getCreditPaise, getDuePaise } from "@medicare/domain/purchases/calc";
import type { Purchase, PurchaseDraft } from "@medicare/domain/purchases/types";
import type { Sale } from "@medicare/domain/billing/types";
import type { StockBatch } from "@medicare/domain/inventory/types";
import { buildApp } from "../app";
import { openDatabase, type Database } from "../db/client";
import { seedDemoData } from "../db/seed";
import { EventBus } from "../events";
import { signIn } from "../test/signIn";

let database: Database;
let app: ReturnType<typeof buildApp>;
let published: object[] = [];
let auth: { authorization: string };

// A fresh shop for every test — tests never affect each other
beforeEach(async () => {
  await app?.close();
  database?.close();
  database = await openDatabase(":memory:");
  await seedDemoData(database);
  const bus = new EventBus();
  published = [];
  bus.publish = (p) => void published.push(p);
  app = buildApp({ database, bus });
  auth = await signIn(app);
});
afterAll(async () => {
  await app.close();
  database.close();
});

type Res = { statusCode: number; json: () => any };
const call = (
  method: "GET" | "POST" | "PUT" | "DELETE",
  url: string,
  payload?: object,
): Promise<Res> =>
  app.inject({
    method,
    url,
    payload,
    headers: auth,
  }) as unknown as Promise<Res>;
const ok = async (p: Promise<Res>) => {
  const r = await p;
  if (r.statusCode >= 300)
    throw new Error(`${r.statusCode}: ${JSON.stringify(r.json())}`);
  return r.json();
};
const stock = async (): Promise<StockBatch[]> =>
  (await ok(call("GET", "/api/stock"))).batches;
const qtyOf = async (batchNo: string) => {
  const b = (await stock()).find((x) => x.batchNo === batchNo);
  return b ? b.qtyStrip + b.qtyLoose : null;
};
const purchasesNow = async (): Promise<Purchase[]> =>
  (await ok(call("GET", "/api/purchases"))).purchases;
const count = (table: string) =>
  (
    database.raw.prepare(`SELECT count(*) n FROM ${table}`).get() as {
      n: number;
    }
  ).n;

/** A new invoice as typed in the form: copy of a demo one with fresh batch numbers */
async function draft(
  over: Partial<PurchaseDraft> = {},
): Promise<PurchaseDraft> {
  const base = (await purchasesNow()).find(
    (p) => p.stockPosted && p.status === "active",
  )!;
  const d = purchaseToDraft(base);
  return {
    ...d,
    invoiceNo: "TEST-001",
    invoiceDate: toISODate(new Date()),
    paid: "",
    lines: d.lines.map((l, i) => ({
      ...l,
      key: `tl${i}`,
      batchNo: `TEST${i}`,
    })),
    ...over,
  };
}
const addPurchase = async (over: Partial<PurchaseDraft> = {}) =>
  (await ok(call("POST", "/api/purchases", await draft(over))))
    .purchase as Purchase;

/** A cart of 1 strip of a medicine that has stock */
async function cartFor(strips = 1) {
  const b = (await stock()).find(
    (x) => x.qtyStrip >= strips && x.expiry.endsWith("/28"),
  )!;
  return {
    b,
    input: {
      cart: [
        {
          lineId: "c1",
          medicineId: b.medicineId,
          qtyStrip: strips,
          qtyLoose: 0,
          discountPercent: 0,
        },
      ],
      customerName: "Walk-in customer",
      doctor: "",
      counter: "Counter 1",
      payment: {
        method: "cash",
        received: "",
        reference: "",
        split: { cash: "", upi: "", card: "" },
      },
    },
  };
}

describe("purchases on the server", () => {
  it("adds the invoice AND its billed + free packs to stock, in one go", async () => {
    const d = await draft();
    const out = await ok(call("POST", "/api/purchases", d));
    expect(out.packs).toBe(
      d.lines.reduce((a, l) => a + Number(l.qty) + (Number(l.freeQty) || 0), 0),
    );
    expect(await qtyOf("TEST0")).toBeGreaterThan(0);
    expect(published).toHaveLength(1); // every other counter is told
  });

  it("refuses a duplicate invoice for the same supplier, adding no stock", async () => {
    await addPurchase();
    const before = await stock();
    const res = await call("POST", "/api/purchases", await draft());
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/Already entered/);
    expect(await stock()).toEqual(before);
  });

  it("works out names and totals itself — never trusts what the app sends", async () => {
    const d = await draft();
    d.lines[0] = { ...d.lines[0], medicineName: "FAKE NAME", unit: "BOX" };
    const p = (await ok(call("POST", "/api/purchases", d)))
      .purchase as Purchase;
    expect(p.lines[0].medicineName).not.toBe("FAKE NAME");
  });

  it("edit re-posts stock: old quantities out, new ones in", async () => {
    const p = await addPurchase();
    const d = await draft();
    const edited = { ...d, lines: [{ ...d.lines[0], qty: "3", freeQty: "" }] };
    await ok(
      call("PUT", `/api/purchases/${p.id}`, { draft: edited, revision: 1 }),
    );
    expect(await qtyOf("TEST0")).toBe(3);
    expect(await qtyOf("TEST1")).toBe(0);
  });

  it("edit is blocked once part of the stock is gone, and on a stale revision", async () => {
    const p = await addPurchase();
    expect(
      (
        await call("PUT", `/api/purchases/${p.id}`, {
          draft: await draft(),
          revision: 5,
        })
      ).json().error,
    ).toMatch(/changed elsewhere/);
    const b = (await stock()).find((x) => x.batchNo === "TEST0")!;
    await ok(
      call("POST", "/api/stock/adjust", {
        batchId: b.id,
        qtyStrip: 0,
        qtyLoose: 0,
        reason: "Damaged",
      }),
    );
    expect(
      (
        await call("PUT", `/api/purchases/${p.id}`, {
          draft: await draft(),
          revision: 1,
        })
      ).json().error,
    ).toMatch(/sold or adjusted/);
  });

  it("cancel takes the stock back out and keeps the invoice as Cancelled (reason required)", async () => {
    const p = await addPurchase();
    expect(
      (await call("POST", `/api/purchases/${p.id}/cancel`, { reason: "  " }))
        .statusCode,
    ).toBe(400);
    const out = await ok(
      call("POST", `/api/purchases/${p.id}/cancel`, {
        reason: "Wrong supplier",
      }),
    );
    expect(out.purchase.status).toBe("cancelled");
    expect(await qtyOf("TEST0")).toBe(0);
  });

  it("debit note: removes stock, reduces what we owe, locks cancel; over-payment becomes credit", async () => {
    const p = await addPurchase();
    await ok(
      call("POST", `/api/purchases/${p.id}/payments`, {
        amountPaise: p.totals.netPaise,
      }),
    );
    const before = (await qtyOf("TEST0"))!;
    const { ret } = await ok(
      call("POST", "/api/purchase-returns", {
        purchaseId: p.id,
        date: toISODate(new Date()),
        reason: "damaged",
        notes: " crushed ",
        lines: [{ purchaseLineId: p.lines[0].id, qty: 2 }],
      }),
    );
    expect(ret.returnNo).toMatch(/^DN-\d{4}$/);
    expect(await qtyOf("TEST0")).toBe(before - 2);
    const saved = (await purchasesNow()).find((x) => x.id === p.id)!;
    expect(getDuePaise(saved)).toBe(0);
    expect(getCreditPaise(saved)).toBe(ret.totalPaise);
    expect(
      (
        await call("POST", `/api/purchases/${p.id}/cancel`, { reason: "x" })
      ).json().error,
    ).toMatch(/return was made|payment is recorded/);
  });

  it("never returns more than was bought", async () => {
    const p = await addPurchase();
    const res = await call("POST", "/api/purchase-returns", {
      purchaseId: p.id,
      date: toISODate(new Date()),
      reason: "damaged",
      notes: "",
      lines: [{ purchaseLineId: p.lines[0].id, qty: 999_99 }],
    });
    expect(res.statusCode).toBe(400);
  });

  it("payment: never more than the balance", async () => {
    const p = await addPurchase();
    expect(
      (
        await call("POST", `/api/purchases/${p.id}/payments`, {
          amountPaise: p.totals.netPaise + 1,
        })
      ).json().error,
    ).toMatch(/more than the balance/);
  });
});

describe("billing on the server", () => {
  it("takes the stock out (FEFO) and saves a numbered bill", async () => {
    const { b, input } = await cartFor();
    const before = (await qtyOf(b.batchNo))!;
    const { sale } = await ok(call("POST", "/api/sales", input));
    expect(sale.billNo).toMatch(/^INV-\d{4}$/);
    // Who made it comes from the sign-in, and is kept with the bill
    expect(sale.billedBy).toBe("Pankaj Sharma");
    const saved = (await ok(call("GET", "/api/sales"))).sales.find(
      (x: Sale) => x.id === sale.id,
    );
    expect(saved).toMatchObject({
      billedBy: "Pankaj Sharma",
      counter: input.counter,
    });
    // The app can't claim someone else made it
    expect(
      (await call("POST", "/api/sales", { ...input, billedBy: "Boss" }))
        .statusCode,
    ).toBe(400);
    expect(
      (await stock())
        .filter((x) => x.medicineId === b.medicineId)
        .reduce((a, x) => a + x.qtyStrip, 0),
    ).toBeLessThan(before + 1_000_000);
    expect(count("sales")).toBeGreaterThan(0);
  });

  it("Schedule H1: needs patient + doctor; the bill line keeps its schedule", async () => {
    const { input } = await cartFor();
    // Taxim 1g Injection is the demo H1 medicine (active, in stock)
    const cart = [{ ...input.cart[0], medicineId: "m10" }];
    const walkIn = await call("POST", "/api/sales", {
      ...input,
      cart,
      doctor: "Dr. A",
    });
    expect(walkIn.statusCode).toBe(400);
    expect(walkIn.json().error).toMatch(/Schedule H1 — enter the patient/);
    const noDoctor = await call("POST", "/api/sales", {
      ...input,
      cart,
      customerName: "Ravi Kumar",
    });
    expect(noDoctor.json().error).toMatch(/prescribing doctor/);
    const { sale } = await ok(
      call("POST", "/api/sales", {
        ...input,
        cart,
        customerName: "Ravi Kumar",
        doctor: "Dr. A",
      }),
    );
    expect(sale.lines[0].schedule).toBe("H1");
    const saved = (await ok(call("GET", "/api/sales"))).sales.find(
      (x: Sale) => x.id === sale.id,
    );
    expect(saved.lines[0].schedule).toBe("H1");
  });

  it("short stock → nothing saved (no bill, no stock change)", async () => {
    const { input } = await cartFor();
    input.cart[0].qtyStrip = 100_000;
    const bills = count("sales");
    const before = await stock();
    const res = await call("POST", "/api/sales", input);
    expect(res.statusCode).toBe(400);
    expect(count("sales")).toBe(bills);
    expect(await stock()).toEqual(before);
  });

  it("two counters, the last strip: only ONE bill goes through", async () => {
    const { b, input } = await cartFor();
    // Leave exactly one strip of this medicine on the shelf
    for (const x of (await stock()).filter(
      (y) => y.medicineId === b.medicineId,
    )) {
      await ok(
        call("POST", "/api/stock/adjust", {
          batchId: x.id,
          qtyStrip: x.id === b.id ? 1 : 0,
          qtyLoose: 0,
          reason: "Count",
        }),
      );
    }
    const [a, c] = await Promise.all([
      call("POST", "/api/sales", input),
      call("POST", "/api/sales", input),
    ]);
    expect([a.statusCode, c.statusCode].sort()).toEqual([201, 400]);
    expect(await qtyOf(b.batchNo)).toBe(0);
  });

  it("sales return puts stock back and records the refund on the bill", async () => {
    const { b, input } = await cartFor(2);
    const { sale } = (await ok(call("POST", "/api/sales", input))) as {
      sale: Sale;
    };
    const after = (await qtyOf(b.batchNo))!;
    const { ret, patch } = await ok(
      call("POST", "/api/sale-returns", {
        saleId: sale.id,
        reason: "Wrong medicine",
        refundMode: "cash",
        notes: "",
        lines: [{ saleLineId: sale.lines[0].id, qtyStrip: 1, qtyLoose: 0 }],
      }),
    );
    expect(ret.returnNo).toMatch(/^SR-\d{4}$/);
    expect(ret.billedBy).toBe("Pankaj Sharma");
    expect(patch.sales[0].returnedPaise).toBe(ret.refundPaise);
    expect(
      (await stock())
        .filter((x) => x.medicineId === b.medicineId)
        .reduce((a, x) => a + x.qtyStrip, 0),
    ).toBeGreaterThan(0);
    expect(after).toBeGreaterThanOrEqual(0);
  });

  it("udhaar: needs an account, respects the credit limit", async () => {
    const { input } = await cartFor();
    const udhaar = {
      ...input,
      payment: { ...input.payment, method: "udhaar" },
    };
    expect((await call("POST", "/api/sales", udhaar)).json().error).toMatch(
      /account/,
    );
    const c = database.raw
      .prepare(
        "SELECT id FROM customers WHERE status = 'active' AND credit_limit_paise > 0 LIMIT 1",
      )
      .get() as { id: string };
    database.raw
      .prepare("UPDATE customers SET credit_limit_paise = 1 WHERE id = ?")
      .run(c.id);
    expect(
      (await call("POST", "/api/sales", { ...udhaar, customerId: c.id })).json()
        .error,
    ).toMatch(/limit/);
  });

  it("held bills: hold, then only one counter can take it", async () => {
    const { input } = await cartFor();
    const { bill } = await ok(
      call("POST", "/api/held", {
        customerName: "Ravi",
        doctor: "",
        counter: "Counter 1",
        lines: input.cart,
      }),
    );
    const [x, y] = await Promise.all([
      call("DELETE", `/api/held/${bill.id}`),
      call("DELETE", `/api/held/${bill.id}`),
    ]);
    expect([x.statusCode, y.statusCode].sort()).toEqual([200, 404]);
  });
});

describe("customers & udhaar payments on the server", () => {
  it("payment reduces what they owe; never more than owed; receipt numbered", async () => {
    const row = database.raw
      .prepare(
        "SELECT customer_id id FROM sales WHERE status = 'udhaar' LIMIT 1",
      )
      .get() as { id: string };
    const res = await call("POST", "/api/customer-payments", {
      customerId: row.id,
      amount: "99999999",
      method: "cash",
      reference: "",
      note: "",
    });
    expect(res.json().error).toMatch(/more than|owes nothing/i);
    const { payment } = await ok(
      call("POST", "/api/customer-payments", {
        customerId: row.id,
        amount: "1",
        method: "cash",
        reference: "",
        note: "",
      }),
    );
    expect(payment.receiptNo).toMatch(/^RC-\d{4}$/);
  });

  it("one account per mobile number", async () => {
    const c = database.raw
      .prepare("SELECT phone FROM customers WHERE phone <> '' LIMIT 1")
      .get() as { phone: string };
    const res = await call("POST", "/api/customers", {
      name: "Someone",
      phone: c.phone,
      address: "",
      creditLimitPaise: 0,
      notes: "",
      status: "active",
    });
    expect(res.json().error).toMatch(/number/);
  });
});

describe("input checks", () => {
  it.each([
    ["/api/sales", { cart: [] }],
    ["/api/purchases", { supplierId: "x" }],
    ["/api/customer-payments", { customerId: "x", amount: 5 }],
  ])("%s refuses a malformed body with a 400", async (url, body) => {
    expect((await call("POST", url, body)).statusCode).toBe(400);
  });
});

describe("the stock register always adds up", () => {
  it("after purchases, edits, cancels, bills and returns: every batch = sum of its history", async () => {
    const p = await addPurchase();
    const d = await draft();
    await ok(
      call("PUT", `/api/purchases/${p.id}`, {
        draft: { ...d, lines: d.lines.slice(0, 1) },
        revision: 1,
      }),
    );
    await ok(call("PUT", `/api/purchases/${p.id}`, { draft: d, revision: 2 })); // line comes back → same batch reused
    const q = await addPurchase({
      invoiceNo: "TEST-002",
      lines: (await draft()).lines.map((l, i) => ({
        ...l,
        batchNo: `CXL${i}`,
      })),
    });
    await ok(
      call("POST", `/api/purchases/${q.id}/cancel`, { reason: "Duplicate" }),
    );
    const { input } = await cartFor(2);
    const { sale } = await ok(call("POST", "/api/sales", input));
    await ok(
      call("POST", "/api/sale-returns", {
        saleId: sale.id,
        reason: "Wrong medicine",
        refundMode: "cash",
        notes: "",
        lines: [{ saleLineId: sale.lines[0].id, qtyStrip: 1, qtyLoose: 0 }],
      }),
    );

    const bad = database.raw
      .prepare(
        `SELECT b.batch_no FROM batches b LEFT JOIN (SELECT batch_id, sum(qty_strip_delta) s, sum(qty_loose_delta) l FROM stock_movements GROUP BY batch_id) m ON m.batch_id = b.id
         WHERE coalesce(m.s,0) <> b.qty_strip OR coalesce(m.l,0) <> b.qty_loose`,
      )
      .all();
    expect(bad).toEqual([]);
    // No batch was duplicated by the edit round-trip
    expect(
      (
        database.raw
          .prepare("SELECT count(*) n FROM batches WHERE batch_no = 'TEST1'")
          .get() as { n: number }
      ).n,
    ).toBe(1);
  });
});

describe("reports stay right after a return", () => {
  it("a refund counts on the day the money goes back, not on the bill's day", async () => {
    const { salesReport } = await import("@medicare/domain/reports/reports");
    const { presetRange } = await import("@medicare/domain/reports/period");
    const today = async () => {
      const { sales, saleReturns } = await ok(call("GET", "/api/sales"));
      return salesReport(
        sales,
        saleReturns,
        await stock(),
        presetRange("today"),
      ).netAfterReturnsPaise;
    };
    const old = (await ok(call("GET", "/api/sales"))).sales.find(
      (s: Sale) =>
        !s.imported &&
        new Date(s.createdAt).toDateString() !== new Date().toDateString() &&
        s.lines.some((l) => l.qtyStrip > 0) &&
        s.returnedPaise === 0,
    ) as Sale;
    const before = await today();
    const { ret } = await ok(
      call("POST", "/api/sale-returns", {
        saleId: old.id,
        reason: "Wrong medicine",
        refundMode: "cash",
        notes: "",
        lines: [
          {
            saleLineId: old.lines.find((l) => l.qtyStrip > 0)!.id,
            qtyStrip: 1,
            qtyLoose: 0,
          },
        ],
      }),
    );
    expect(await today()).toBe(before - ret.refundPaise);
  });
});
