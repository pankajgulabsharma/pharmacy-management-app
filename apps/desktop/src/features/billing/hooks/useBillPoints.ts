import { useMemo } from "react";
import type { SaleTotals } from "@medicare/domain/billing/types";
import { applyLoyalty } from "@medicare/domain/billing/sale";
import {
  earnedPoints,
  maxRedeemable,
} from "@medicare/domain/customers/loyalty";
import { useCustomerStore } from "@/features/customers/store/useCustomerStore";
import { useSettingsStore } from "@/features/settings/store/useSettingsStore";

export type BillPoints = {
  /** Points on the account before this bill */
  balance: number;
  /** Points used on this bill (0 = not using) */
  using: number;
  /** Most that could be used on this bill (0 = can't use any yet) */
  max: number;
  /** Points this bill will earn */
  earn: number;
  minRedeem: number;
  pointValuePaise: number;
};

/**
 * Loyalty on the bill being made — the same rule the server applies
 * (applyLoyalty). "Use points" always takes as many as this bill allows,
 * so changing the cart never leaves an invalid number behind.
 */
export function useBillPoints(
  customerId: string | null,
  lineTotals: SaleTotals,
  usePoints: boolean,
): { totals: SaleTotals; redeem: number; points: BillPoints | null } {
  const settings = useSettingsStore((s) => s.loyalty);
  const balance = useCustomerStore((s) =>
    customerId ? (s.points[customerId] ?? 0) : 0,
  );
  return useMemo(() => {
    if (!settings.enabled || !customerId || lineTotals.netPaise <= 0)
      return { totals: lineTotals, redeem: 0, points: null };
    const max = maxRedeemable(balance, lineTotals.netPaise, settings);
    const redeem = usePoints ? max : 0;
    const r = applyLoyalty(lineTotals, customerId, redeem, {
      settings,
      balance,
    });
    const totals = r.error ? lineTotals : r.totals;
    return {
      totals,
      redeem: r.error ? 0 : redeem,
      points: {
        balance,
        using: r.error ? 0 : redeem,
        max,
        earn: r.error ? earnedPoints(lineTotals.netPaise, settings) : r.earned,
        minRedeem: settings.minRedeem,
        pointValuePaise: settings.pointValuePaise,
      },
    };
  }, [settings, customerId, balance, lineTotals, usePoints]);
}
