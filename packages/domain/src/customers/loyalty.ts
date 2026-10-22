/**
 * Loyalty points — for saved customers only (the points live on their
 * account):
 *
 *   earn    → every paid ₹100 gives `pointsPer100` points (default 1)
 *   redeem  → points come off a later bill, each worth `pointValuePaise`
 *             (default ₹1); at least `minRedeem` points, at most
 *             `maxRedeemPercent` of that bill
 *   return  → the points earned on what came back are taken back, and the
 *             points spent on it are given back (both in proportion)
 *
 * Nothing is stored per customer: the balance is worked out from their
 * bills and returns, so it can never drift.
 */
import type { Paise } from "../lib/money";

export type LoyaltySettings = {
  enabled: boolean;
  /** Points for every ₹100 of the bill (after points used) */
  pointsPer100: number;
  /** What one point is worth on a bill */
  pointValuePaise: Paise;
  /** Fewest points that can be used at once */
  minRedeem: number;
  /** Most of a bill that points may pay (%) */
  maxRedeemPercent: number;
};

export const DEFAULT_LOYALTY: LoyaltySettings = {
  enabled: false,
  pointsPer100: 1,
  pointValuePaise: 100,
  minRedeem: 50,
  maxRedeemPercent: 50,
};

export const LOYALTY_LIMITS = {
  pointsPer100: { min: 1, max: 20 },
  pointValuePaise: { min: 10, max: 1000 },
  minRedeem: { min: 1, max: 10_000 },
  maxRedeemPercent: { min: 1, max: 100 },
} as const;

const clampInt = (v: unknown, min: number, max: number, d: number) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : d;
};

export function cleanLoyalty(raw: unknown): LoyaltySettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const d = DEFAULT_LOYALTY;
  const L = LOYALTY_LIMITS;
  return {
    enabled: r.enabled === true,
    pointsPer100: clampInt(
      r.pointsPer100,
      L.pointsPer100.min,
      L.pointsPer100.max,
      d.pointsPer100,
    ),
    pointValuePaise: clampInt(
      r.pointValuePaise,
      L.pointValuePaise.min,
      L.pointValuePaise.max,
      d.pointValuePaise,
    ),
    minRedeem: clampInt(
      r.minRedeem,
      L.minRedeem.min,
      L.minRedeem.max,
      d.minRedeem,
    ),
    maxRedeemPercent: clampInt(
      r.maxRedeemPercent,
      L.maxRedeemPercent.min,
      L.maxRedeemPercent.max,
      d.maxRedeemPercent,
    ),
  };
}

/** Points earned on a bill of `netPaise` (what the customer paid) */
export function earnedPoints(netPaise: Paise, s: LoyaltySettings): number {
  if (!s.enabled || netPaise <= 0) return 0;
  return Math.floor((netPaise * s.pointsPer100) / 100_00);
}

/** Most points usable on a bill of `billPaise` (before points) */
export function maxRedeemable(
  balance: number,
  billPaise: Paise,
  s: LoyaltySettings,
): number {
  if (!s.enabled || balance <= 0 || billPaise <= 0) return 0;
  const cap = Math.floor(
    (billPaise * s.maxRedeemPercent) / 100 / s.pointValuePaise,
  );
  const n = Math.min(balance, cap);
  return n >= s.minRedeem ? n : 0;
}

/** Why these points can't be used (null = fine) */
export function checkRedeem(
  points: number,
  balance: number,
  billPaise: Paise,
  s: LoyaltySettings,
): string | null {
  if (!points) return null;
  if (!s.enabled) return "Loyalty points are switched off";
  if (!Number.isInteger(points) || points < 0)
    return "Points must be a whole number";
  if (points > balance) return `Only ${balance} points available`;
  if (points < s.minRedeem) return `Use at least ${s.minRedeem} points`;
  const cap = Math.floor(
    (billPaise * s.maxRedeemPercent) / 100 / s.pointValuePaise,
  );
  if (points > cap)
    return `Points can pay at most ${s.maxRedeemPercent}% of the bill (${cap} points)`;
  return null;
}

/** What a sale / return carries for the balance */
export type PointsSale = {
  customerId?: string | null;
  pointsEarned?: number;
  pointsRedeemed?: number;
};
export type PointsReturn = {
  saleId: string;
  pointsReversed?: number;
  pointsRestored?: number;
};

/** Every customer's points balance, from their bills and returns */
export function pointsBalances(
  sales: readonly (PointsSale & { id: string })[],
  returns: readonly PointsReturn[],
): Map<string, number> {
  const owner = new Map<string, string>();
  const out = new Map<string, number>();
  const add = (cid: string, n: number) => out.set(cid, (out.get(cid) ?? 0) + n);
  for (const s of sales) {
    if (!s.customerId) continue;
    owner.set(s.id, s.customerId);
    const n = (s.pointsEarned ?? 0) - (s.pointsRedeemed ?? 0);
    if (n) add(s.customerId, n);
  }
  for (const r of returns) {
    const cid = owner.get(r.saleId);
    if (!cid) continue;
    const n = (r.pointsRestored ?? 0) - (r.pointsReversed ?? 0);
    if (n) add(cid, n);
  }
  return out;
}

/**
 * Points moved by a return: share of the bill that came back (refund /
 * what was paid). Rounded down both ways, so the totals never exceed
 * what the bill earned or used.
 */
export function returnPoints(
  sale: { pointsEarned?: number; pointsRedeemed?: number; netPaise: Paise },
  refundPaise: Paise,
): { pointsReversed: number; pointsRestored: number } {
  const earned = sale.pointsEarned ?? 0;
  const used = sale.pointsRedeemed ?? 0;
  if ((!earned && !used) || sale.netPaise <= 0)
    return { pointsReversed: 0, pointsRestored: 0 };
  const share = Math.min(1, refundPaise / sale.netPaise);
  return {
    pointsReversed: Math.floor(earned * share),
    pointsRestored: Math.floor(used * share),
  };
}
