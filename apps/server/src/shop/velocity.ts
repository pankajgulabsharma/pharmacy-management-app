/**
 * How fast each medicine sells — over ALL bills in the database (a counter
 * keeps only the recent ones), for dead stock and the order list.
 */
import type { DatabaseSync } from "node:sqlite";
import type { SalesVelocity } from "@medicare/domain/reports/stockInsights";

/** Packs from a strip + loose quantity (LSE medicines: loose units) */
const PACKS = `CASE WHEN l.unit = 'LSE' THEN l.qty_loose
  ELSE l.qty_strip + l.qty_loose * 1.0 / max(l.units_per_strip, 1) END`;

export function salesVelocity(
  raw: DatabaseSync,
  days: number,
  now = new Date(),
): { since: string; items: SalesVelocity[] } {
  const since = new Date(now.getTime() - days * 86_400_000).toISOString();
  const sold = raw
    .prepare(
      `SELECT l.medicine_id id, max(s.created_at) last,
         sum(CASE WHEN s.created_at >= ? THEN ${PACKS} ELSE 0 END) packs
       FROM sale_lines l JOIN sales s ON s.id = l.sale_id
       GROUP BY l.medicine_id`,
    )
    .all(since) as { id: string; last: string; packs: number }[];
  // Customer returns in the window take that sale back
  const returned = new Map(
    (
      raw
        .prepare(
          `SELECT l.medicine_id id, sum(${PACKS}) packs
           FROM sale_return_lines l JOIN sale_returns r ON r.id = l.return_id
           WHERE r.created_at >= ? GROUP BY l.medicine_id`,
        )
        .all(since) as { id: string; packs: number }[]
    ).map((r) => [r.id, r.packs]),
  );
  return {
    since,
    items: sold.map((r) => ({
      medicineId: r.id,
      lastSoldAt: r.last,
      soldPacks: Math.max(0, r.packs - (returned.get(r.id) ?? 0)),
    })),
  };
}
