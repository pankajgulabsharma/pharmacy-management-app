import { describe, expect, it } from "vitest";
import type { Medicine } from "../medicines/types";
import {
  buildOrderLines,
  canEditOrder,
  makeOrder,
  nextOrderNo,
  orderHtml,
  orderMessage,
  orderToDraft,
  orderValuePaise,
  receiveOnOrder,
  shortLines,
} from "./orders";

const med = (id: string, gst = 12) =>
  ({
    id,
    name: `Med ${id}`,
    brand: "Co",
    unit: "STP",
    unitsPerStrip: 10,
    gstPercent: gst,
    mrp: 100,
    hsn: "3004",
    status: "active",
  }) as Medicine;
const meds = new Map([med("m1"), med("m2", 5)].map((m) => [m.id, m]));
const now = new Date(2026, 9, 22, 10);

const order = () =>
  makeOrder(
    {
      supplierId: "s1",
      notes: "  Urgent  ",
      lines: [
        { medicineId: "m1", qty: 10, ratePaise: 5000 },
        { medicineId: "m2", qty: 4, ratePaise: 0 },
      ],
    },
    { id: "s1", name: "Sup One" },
    meds,
    "PO/26-27/0001",
    "Pankaj",
    now,
  );
const bill = (
  lines: { medicineId: string; qty: number; freeQty: number }[],
  supplierId = "s1",
) => ({ id: "p1", invoiceNo: "INV-1", supplierId, lines }) as never;

describe("purchase orders", () => {
  it("numbers per financial year", () => {
    expect(nextOrderNo([], now)).toBe("PO/26-27/0001");
    expect(
      nextOrderNo(
        [{ orderNo: "PO/26-27/0007", createdAt: now.toISOString() }],
        now,
      ),
    ).toBe("PO/26-27/0008");
  });

  it("checks lines against the master", () => {
    const o = order();
    expect(o.status).toBe("open");
    expect(o.notes).toBe("Urgent");
    expect(o.lines.map((l) => [l.medicineName, l.qty, l.gstPercent])).toEqual([
      ["Med m1", 10, 12],
      ["Med m2", 4, 5],
    ]);
    expect(() => buildOrderLines([], meds)).toThrow(/at least one/);
    expect(() =>
      buildOrderLines([{ medicineId: "m1", qty: 0, ratePaise: 0 }], meds),
    ).toThrow(/quantity/);
    expect(() =>
      buildOrderLines(
        [
          { medicineId: "m1", qty: 1, ratePaise: 0 },
          { medicineId: "m1", qty: 2, ratePaise: 0 },
        ],
        meds,
      ),
    ).toThrow(/twice/);
    // 10 × ₹50 + 12% GST
    expect(orderValuePaise(o.lines)).toBe(56000);
  });

  it("receiving ticks off billed + free; short stays; done → received", () => {
    const o = order();
    const p1 = receiveOnOrder(
      o,
      bill([{ medicineId: "m1", qty: 6, freeQty: 1 }]),
      now,
    );
    expect(p1.status).toBe("partial");
    expect(p1.lines.map((l) => l.receivedQty)).toEqual([7, 0]);
    expect(shortLines(p1).map((l) => l.medicineId)).toEqual(["m1", "m2"]);
    expect(canEditOrder(p1)).toBe(false);
    // The next bill is filled with what's still to come
    const d = orderToDraft(p1, meds, now);
    expect(d.orderId).toBe(o.id);
    expect(d.supplierId).toBe("s1");
    expect(d.lines.map((l) => [l.medicineId, l.qty, l.rate])).toEqual([
      ["m1", "3", "50"],
      ["m2", "4", ""],
    ]);
    const p2 = receiveOnOrder(
      p1,
      bill([
        { medicineId: "m1", qty: 3, freeQty: 0 },
        { medicineId: "m2", qty: 4, freeQty: 0 },
      ]),
      now,
    );
    expect(p2.status).toBe("received");
    expect(p2.receipts).toHaveLength(2);
    expect(() => receiveOnOrder(p2, bill([]), now)).toThrow(/already/);
    expect(() => receiveOnOrder(o, bill([], "s2"), now)).toThrow(/Sup One/);
  });

  it("message and print", () => {
    const o = order();
    const msg = orderMessage(o, { name: "Shop" });
    expect(msg).toContain("PO/26-27/0001");
    expect(msg).toContain("*Med m1* — 10 STP");
    const html = orderHtml(o, { name: "Shop" }, {});
    expect(html).toContain("PURCHASE ORDER");
    expect(html).toContain("Med m2");
  });
});
