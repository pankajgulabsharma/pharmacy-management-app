import { describe, expect, it } from "vitest";
import type { Sale, SaleReturn } from "../billing/types";
import { returnedByDay, soldByDay, wholePeriod } from "./itemsByDay";

const range = {
  from: new Date(2026, 9, 1),
  to: new Date(2026, 9, 31, 23, 59, 59, 999),
};
const line = (id: string, strip: number, loose: number, amount: number) => ({
  medicineId: id,
  medicineName: id === "d" ? "Dolo 650" : "Pan 40",
  unit: "STP",
  qtyStrip: strip,
  qtyLoose: loose,
  amountPaise: amount,
});
const sale = (day: number, lines: ReturnType<typeof line>[]) =>
  ({
    createdAt: new Date(2026, 9, day, 11).toISOString(),
    lines,
    totals: { netPaise: lines.reduce((s, l) => s + l.amountPaise, 0) },
  }) as unknown as Sale;

describe("medicines sold / returned, day by day", () => {
  const sales = [
    sale(14, [line("d", 1, 0, 3000)]),
    sale(15, [line("d", 1, 5, 4500), line("p", 2, 0, 20000)]),
    sale(15, [line("d", 2, 0, 6000)]),
    sale(3, [line("p", 1, 0, 10000)]),
    sale(1 + 40, [line("p", 9, 0, 99999)]), // November — outside
  ];

  it("newest day first; inside a day the biggest amount first", () => {
    const days = soldByDay(sales, range);
    expect(days.map((d) => d.date)).toEqual([
      "2026-10-15",
      "2026-10-14",
      "2026-10-03",
    ]);
    expect(days[0]).toMatchObject({ docs: 2, amountPaise: 30500 });
    expect(days[0].items).toEqual([
      expect.objectContaining({ name: "Pan 40", qtyStrip: 2, docs: 1 }),
      expect.objectContaining({
        name: "Dolo 650",
        qtyStrip: 3,
        qtyLoose: 5,
        docs: 2,
        amountPaise: 10500,
      }),
    ]);
  });

  it("whole period adds the days up", () => {
    const all = wholePeriod(soldByDay(sales, range))!;
    expect(all.docs).toBe(4);
    expect(all.items.map((r) => [r.name, r.qtyStrip, r.docs])).toEqual([
      ["Pan 40", 3, 2],
      ["Dolo 650", 4, 3],
    ]);
    expect(wholePeriod([])).toBeNull();
  });

  it("returns are grouped the same way (refund amounts)", () => {
    const ret = {
      createdAt: new Date(2026, 9, 15, 18).toISOString(),
      refundPaise: 3000,
      lines: [line("d", 1, 0, 3000)],
    } as unknown as SaleReturn;
    expect(returnedByDay([ret], range)).toEqual([
      {
        date: "2026-10-15",
        docs: 1,
        amountPaise: 3000,
        items: [expect.objectContaining({ name: "Dolo 650", qtyStrip: 1 })],
      },
    ]);
  });
});
