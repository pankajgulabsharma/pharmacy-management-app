import { describe, expect, it } from "vitest";
import type { Sale } from "../billing/types";
import {
  cleanDenominations,
  countedTotal,
  differenceOf,
  summarizeGalla,
  type CashEntry,
} from "./galla";

const bill = (net: number, payment: Partial<Sale["payment"]>): Sale =>
  ({
    totals: { netPaise: net },
    payment: {
      method: "cash",
      receivedPaise: 0,
      changePaise: 0,
      split: null,
      reference: "",
      ...payment,
    },
  }) as Sale;
const entry = (p: Partial<CashEntry>): CashEntry => ({
  id: "e",
  date: "2026-10-21",
  counter: "",
  at: "",
  kind: "out",
  category: "Shop expense",
  amountPaise: 0,
  note: "",
  by: "",
  source: "manual",
  ref: "",
  ...p,
});

describe("galla", () => {
  it("expected = opening + cash in − cash out; only the cash part of a split", () => {
    const s = summarizeGalla({
      openingPaise: 2000_00,
      sales: [
        bill(184_00, {
          method: "cash",
          receivedPaise: 200_00,
          changePaise: 16_00,
        }),
        bill(300_00, { method: "upi" }),
        bill(500_00, {
          method: "split",
          split: { cashPaise: 200_00, upiPaise: 300_00, cardPaise: 0 },
        }),
        bill(450_00, { method: "udhaar" }),
      ],
      entries: [
        entry({
          kind: "in",
          source: "udhaar",
          category: "Udhaar received",
          amountPaise: 100_00,
        }),
        entry({
          kind: "out",
          source: "refund",
          category: "Cash refund",
          amountPaise: 120_00,
        }),
        entry({
          kind: "out",
          source: "supplier",
          category: "Supplier payment",
          amountPaise: 1000_00,
        }),
        entry({ kind: "out", amountPaise: 60_00 }),
      ],
    });
    expect(s).toMatchObject({
      cashBills: 2,
      cashSalesPaise: 384_00,
      udhaarCollectedPaise: 100_00,
      refundsPaise: 120_00,
      supplierPaidPaise: 1000_00,
      otherOutPaise: 60_00,
      expectedPaise: 2000_00 + 484_00 - 1180_00,
      bills: 4,
      upiPaise: 600_00,
      udhaarGivenPaise: 450_00,
    });
  });

  it("counts notes and coins; cleans junk; short / excess", () => {
    expect(countedTotal({ "500": 3, "100": 2, coins: 45_00 })).toBe(1745_00);
    expect(
      cleanDenominations({ "500": "2", "7": 9, "100": -1, coins: 12.4 }),
    ).toEqual({ "500": 2, coins: 12 });
    expect(differenceOf({ countedPaise: 950_00, expectedPaise: 1000_00 })).toBe(
      -50_00,
    );
    expect(
      differenceOf({ countedPaise: null, expectedPaise: 1000_00 }),
    ).toBeNull();
  });
});
