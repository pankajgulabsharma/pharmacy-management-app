import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { toISODate } from "@medicare/domain/lib/date";
import { purchaseToDraft } from "@medicare/domain/purchases/draft";
import { orderToDraft } from "@medicare/domain/purchases/orders";
import type { PurchaseOrder } from "@medicare/domain/purchases/orders";
import type { Purchase } from "@medicare/domain/purchases/types";
import { buildApp } from "../app";
import { openDatabase, type Database } from "../db/client";
import * as m from "../db/mappers";
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
  method: "GET" | "POST" | "PUT" | "DELETE",
  url: string,
  h: object,
  payload?: object,
) => app.inject({ method, url, headers: h as never, payload });
const meds = () =>
  new Map(m.loadMedicinesSync(database.raw).map((x) => [x.id, x]));

describe("purchase orders", () => {
  let order: PurchaseOrder;
  const [a, b] = ["m1", "m3"];

  it("makes an order (PO number, last rates); cashier can't", async () => {
    const body = {
      supplierId: "s1",
      notes: "Urgent",
      lines: [
        { medicineId: a, qty: 10, ratePaise: 5000 },
        { medicineId: b, qty: 4, ratePaise: 0 },
      ],
    };
    expect(
      (await call("POST", "/api/purchase-orders", cashier, body)).statusCode,
    ).toBe(403);
    const r = await call("POST", "/api/purchase-orders", owner, body);
    expect(r.statusCode).toBe(201);
    order = r.json();
    expect(order.orderNo).toMatch(/^PO\/\d{2}-\d{2}\/0001$/);
    expect(order.status).toBe("open");
    expect(
      order.lines.map((l) => [l.medicineId, l.qty, l.receivedQty]),
    ).toEqual([
      [a, 10, 0],
      [b, 4, 0],
    ]);
    // Same medicine twice / unknown medicine are refused
    expect(
      (
        await call("POST", "/api/purchase-orders", owner, {
          ...body,
          lines: [body.lines[0], body.lines[0]],
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await call("POST", "/api/purchase-orders", owner, {
          ...body,
          lines: [{ medicineId: "nope", qty: 1, ratePaise: 0 }],
        })
      ).statusCode,
    ).toBe(400);
  });

  it("edit and mark sent", async () => {
    const r = await call("PUT", `/api/purchase-orders/${order.id}`, owner, {
      supplierId: "s1",
      notes: "Urgent please",
      lines: [
        { medicineId: a, qty: 12, ratePaise: 5000 },
        { medicineId: b, qty: 4, ratePaise: 0 },
      ],
    });
    expect(r.json().lines[0].qty).toBe(12);
    const s = (
      await call("POST", `/api/purchase-orders/${order.id}/sent`, owner)
    ).json();
    expect(s.status).toBe("sent");
    expect(s.sentAt).toBeTruthy();
    order = s;
  });

  it("a bill entered from the order ticks it off; the rest stays short; close short", async () => {
    const draft = orderToDraft(order, meds());
    expect(draft.orderId).toBe(order.id);
    expect(draft.lines.map((l) => l.qty)).toEqual(["12", "4"]);
    // Only 8 of the 12 came (+1 free), the other medicine not at all
    const bill = {
      ...draft,
      invoiceNo: "PO-TEST-1",
      invoiceDate: toISODate(new Date()),
      lines: [
        {
          ...draft.lines[0],
          key: "k1",
          qty: "8",
          freeQty: "1",
          batchNo: "POB1",
          expiry: "12/29",
          rate: "20",
          mrp: draft.lines[0].mrp || "100",
        },
      ],
    };
    const p = await call("POST", "/api/purchases", owner, bill);
    expect(p.json()).toMatchObject({ purchase: expect.any(Object) });
    const after = (await call("GET", "/api/purchase-orders", owner))
      .json()
      .orders.find((x: PurchaseOrder) => x.id === order.id);
    expect(after.status).toBe("partial");
    expect(
      after.lines.map((l: { receivedQty: number }) => l.receivedQty),
    ).toEqual([9, 0]);
    expect(after.receipts[0].invoiceNo).toBe("PO-TEST-1");

    // Can't edit any more, can't cancel; can close short
    expect(
      (
        await call("PUT", `/api/purchase-orders/${order.id}`, owner, {
          supplierId: "s1",
          notes: "",
          lines: [{ medicineId: a, qty: 1, ratePaise: 0 }],
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (await call("POST", `/api/purchase-orders/${order.id}/cancel`, owner))
        .statusCode,
    ).toBe(400);
    const c = (
      await call("POST", `/api/purchase-orders/${order.id}/close`, owner)
    ).json();
    expect(c.status).toBe("closed");
    // A closed order can't take another bill
    const again = await call("POST", "/api/purchases", owner, {
      ...bill,
      invoiceNo: "PO-TEST-2",
      lines: [{ ...bill.lines[0], key: "k2", batchNo: "POB2" }],
    });
    expect(again.statusCode).toBe(400);
  });

  it("wrong supplier's bill is refused; a fully received order is 'received'; cancel", async () => {
    const o2: PurchaseOrder = (
      await call("POST", "/api/purchase-orders", owner, {
        supplierId: "s2",
        notes: "",
        lines: [{ medicineId: a, qty: 2, ratePaise: 0 }],
      })
    ).json();
    const d = orderToDraft(o2, meds());
    const line = {
      ...d.lines[0],
      key: "x1",
      batchNo: "POC1",
      expiry: "11/29",
      rate: "40",
      mrp: d.lines[0].mrp || "100",
    };
    const wrong = await call("POST", "/api/purchases", owner, {
      ...d,
      supplierId: "s1",
      invoiceNo: "W-1",
      lines: [line],
    });
    expect(wrong.statusCode).toBe(400);
    const okBill = await call("POST", "/api/purchases", owner, {
      ...d,
      invoiceNo: "R-1",
      lines: [line],
    });
    expect(okBill.statusCode).toBe(201);
    const all: PurchaseOrder[] = (
      await call("GET", "/api/purchase-orders", owner)
    ).json().orders;
    expect(all.find((x) => x.id === o2.id)!.status).toBe("received");

    const o3: PurchaseOrder = (
      await call("POST", "/api/purchase-orders", owner, {
        supplierId: "s2",
        notes: "",
        lines: [{ medicineId: b, qty: 1, ratePaise: 0 }],
      })
    ).json();
    expect(
      (await call("POST", `/api/purchase-orders/${o3.id}/close`, owner))
        .statusCode,
    ).toBe(400);
    expect(
      (await call("POST", `/api/purchase-orders/${o3.id}/cancel`, owner)).json()
        .status,
    ).toBe("cancelled");
    // A supplier with orders can't be deleted
    expect((await call("DELETE", "/api/suppliers/s2", owner)).statusCode).toBe(
      409,
    );
  });

  it("ordinary purchases still work without an order", async () => {
    const base = m
      .loadPurchases(database.raw)
      .find((p: Purchase) => p.stockPosted && p.status === "active")!;
    const d = purchaseToDraft(base);
    const r = await call("POST", "/api/purchases", owner, {
      ...d,
      invoiceNo: "NO-PO-1",
      invoiceDate: toISODate(new Date()),
      paid: "",
      lines: d.lines.map((l, i) => ({
        ...l,
        key: `n${i}`,
        batchNo: `NOPO${i}`,
      })),
    });
    expect(r.statusCode).toBe(201);
    expect(r.json().order).toBeNull();
  });
});
