import { describe, expect, it } from "vitest";
import { applyLoyalty } from "../billing/sale";
import { EMPTY_SALE_TOTALS } from "../billing/pricing";
import {
  checkRedeem,
  cleanLoyalty,
  DEFAULT_LOYALTY,
  earnedPoints,
  maxRedeemable,
  pointsBalances,
  returnPoints,
} from "./loyalty";

const on = { ...DEFAULT_LOYALTY, enabled: true };
const totals = (net: number) => ({
  ...EMPTY_SALE_TOTALS,
  itemCount: 1,
  netPaise: net,
});

describe("loyalty points", () => {
  it("earns per ₹100 paid; nothing when switched off", () => {
    expect(earnedPoints(1999_00, on)).toBe(19);
    expect(earnedPoints(99_00, on)).toBe(0);
    expect(earnedPoints(1000_00, DEFAULT_LOYALTY)).toBe(0);
    expect(earnedPoints(1000_00, { ...on, pointsPer100: 2 })).toBe(20);
  });

  it("caps use: balance, % of bill, minimum", () => {
    expect(maxRedeemable(500, 400_00, on)).toBe(200); // 50% of ₹400
    expect(maxRedeemable(120, 1000_00, on)).toBe(120);
    expect(maxRedeemable(30, 1000_00, on)).toBe(0); // below 50
    expect(checkRedeem(60, 50, 1000_00, on)).toMatch(/Only 50/);
    expect(checkRedeem(40, 100, 1000_00, on)).toMatch(/at least 50/);
    expect(checkRedeem(300, 500, 400_00, on)).toMatch(/at most 50%/);
    expect(checkRedeem(100, 500, 400_00, on)).toBeNull();
  });

  it("applies to a bill: off the total, earns on the rest", () => {
    const r = applyLoyalty(totals(500_00), "c1", 100, {
      settings: on,
      balance: 150,
    });
    expect(r.error).toBeNull();
    expect(r.totals.netPaise).toBe(400_00);
    expect(r.totals.pointsPaise).toBe(100_00);
    expect(r.earned).toBe(4);
    expect(r.balanceAfter).toBe(54);
    // No account → can't use points
    expect(
      applyLoyalty(totals(500_00), null, 60, { settings: on, balance: 100 })
        .error,
    ).toMatch(/account/);
  });

  it("returns move points in proportion; balances add up", () => {
    const sale = { pointsEarned: 10, pointsRedeemed: 50, netPaise: 1000_00 };
    expect(returnPoints(sale, 500_00)).toEqual({
      pointsReversed: 5,
      pointsRestored: 25,
    });
    expect(returnPoints(sale, 1000_00)).toEqual({
      pointsReversed: 10,
      pointsRestored: 50,
    });
    const b = pointsBalances(
      [
        { id: "s1", customerId: "c1", pointsEarned: 10 },
        { id: "s2", customerId: "c1", pointsEarned: 3, pointsRedeemed: 8 },
        { id: "s3", customerId: null, pointsEarned: 99 },
      ],
      [{ saleId: "s2", pointsReversed: 3, pointsRestored: 8 }],
    );
    expect(b.get("c1")).toBe(10);
  });

  it("cleans stored settings", () => {
    expect(cleanLoyalty(null)).toEqual(DEFAULT_LOYALTY);
    expect(
      cleanLoyalty({ enabled: true, pointsPer100: 999, maxRedeemPercent: -5 }),
    ).toMatchObject({
      enabled: true,
      pointsPer100: 20,
      maxRedeemPercent: 1,
    });
  });
});

describe("points on the printed bill", () => {
  it("shows points used and the balance", async () => {
    const { pointsLine } = await import("../printing/receipt");
    expect(
      pointsLine({
        pointsEarned: 4,
        pointsRedeemed: 20,
        pointsBalance: 12,
      } as never),
    ).toBe("Points earned +4 · Points balance 12");
    expect(pointsLine({} as never)).toBe("");
  });
});
