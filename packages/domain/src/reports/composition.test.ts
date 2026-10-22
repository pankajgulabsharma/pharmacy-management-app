import { describe, expect, it } from "vitest";
import type { Sale, SaleReturn } from "../billing/types";
import { compositionQuarters, compositionSummary } from "./composition";

const sale = (id: string, at: string, net: number, bos = true) =>
  ({
    id,
    createdAt: at,
    billOfSupply: bos || undefined,
    totals: { netPaise: net },
  }) as unknown as Sale;
const ret = (saleId: string, at: string, refund: number) =>
  ({ saleId, createdAt: at, refundPaise: refund }) as unknown as SaleReturn;

describe("composition scheme report", () => {
  const sales = [
    sale("a", "2026-05-10T10:00:00", 100_000_00),
    sale("b", "2026-06-20T10:00:00", 50_001_00),
    sale("c", "2026-07-05T10:00:00", 30_000_00),
    sale("old", "2026-04-02T10:00:00", 5_000_00, false), // tax invoice before switching
  ];
  const returns = [
    ret("a", "2026-06-01T10:00:00", 1_000_00),
    ret("old", "2026-06-01T10:00:00", 500_00),
  ];

  it("1% of turnover net of returns, split CGST / SGST", () => {
    const s = compositionSummary(sales, returns, {
      from: new Date(2026, 3, 1),
      to: new Date(2026, 5, 30, 23, 59, 59),
    });
    expect(s).toEqual({
      bills: 2,
      salesPaise: 150_001_00,
      returnsPaise: 1_000_00,
      turnoverPaise: 149_001_00,
      taxPaise: 1_490_01,
      cgstPaise: 745_00,
      sgstPaise: 745_01,
      taxInvoices: 1,
    });
  });

  it("four CMP-08 quarters with due dates", () => {
    const q = compositionQuarters(sales, returns, new Date(2026, 9, 22));
    expect(q.map((x) => x.label)).toEqual([
      "Apr–Jun 2026",
      "Jul–Sep 2026",
      "Oct–Dec 2026",
      "Jan–Mar 2027",
    ]);
    expect(q[0].due.toDateString()).toBe(new Date(2026, 6, 18).toDateString());
    expect(q[3].due.toDateString()).toBe(new Date(2027, 3, 18).toDateString());
    expect(q[1].summary.turnoverPaise).toBe(30_000_00);
  });
});
