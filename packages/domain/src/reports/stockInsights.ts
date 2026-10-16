/**
 * Stock insights — what a shop owner asks every week:
 *  - Dead stock: what is sitting on the shelf and not selling (money locked)
 *  - Order list: what to order now, and how much, from the last weeks' sales
 *  - Profit: which medicines / companies actually make money
 * Pure functions; sales speed comes from the server (all bills, not just
 * the recent ones kept on a counter).
 */
import type { Sale } from "../billing/types";
import type { StockBatch } from "../inventory/types";
import { batchCostPaise, batchPacks } from "../inventory/stock";
import { compareExpiry, isExpiryPast, isExpiringWithin } from "../lib/expiry";
import { rupeesToPaise, type Paise } from "../lib/money";
import type { Medicine } from "../medicines/types";
import type { Purchase } from "../purchases/types";
import { inRange, type DateRange } from "./period";
import {
  WA_LINE,
  waJoin,
  waNumber,
  waShopFooter,
  waShopHeader,
  type WhatsAppShop,
} from "../printing/whatsapp";

/** How fast each medicine sells (from the server) */
export type SalesVelocity = {
  medicineId: string;
  /** Last bill with this medicine (ISO), null = never sold */
  lastSoldAt: string | null;
  /** Packs sold in the window, minus customer returns (loose = fraction) */
  soldPacks: number;
};

export const VELOCITY_WINDOWS = [30, 60, 90, 180] as const;
export type VelocityWindow = (typeof VELOCITY_WINDOWS)[number];

const DAY = 86_400_000;
const round1 = (n: number) => Math.round(n * 10) / 10;

type Stock = {
  packs: number;
  costPaise: Paise;
  nearestExpiry: string | null;
  /** Earliest receipt among the batches still on the shelf */
  since: string;
};

/** Sellable stock per medicine (expired batches don't count) */
function stockByMedicine(
  batches: readonly StockBatch[],
  byId: ReadonlyMap<string, Medicine>,
  now: Date,
): Map<string, Stock> {
  const out = new Map<string, Stock>();
  for (const b of batches) {
    const m = byId.get(b.medicineId);
    if (!m || isExpiryPast(b.expiry, now)) continue;
    const packs = batchPacks(b, m);
    if (packs <= 0) continue;
    const s = out.get(m.id) ?? {
      packs: 0,
      costPaise: 0,
      nearestExpiry: null,
      since: b.receivedAt,
    };
    if (b.receivedAt < s.since) s.since = b.receivedAt;
    s.packs += packs;
    s.costPaise += batchCostPaise(b, m);
    if (!s.nearestExpiry || compareExpiry(b.expiry, s.nearestExpiry) < 0)
      s.nearestExpiry = b.expiry;
    out.set(m.id, s);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Dead stock                                                          */
/* ------------------------------------------------------------------ */

export type DeadStockRow = {
  medicineId: string;
  name: string;
  brand: string;
  packs: number;
  unit: string;
  /** Money locked in it (landed cost) */
  costPaise: Paise;
  lastSoldAt: string | null;
  /** Days since it last sold (null = never sold) */
  idleDays: number | null;
  nearestExpiry: string | null;
};

/**
 * In stock but not sold for `days` days (or never) — return it to the
 * supplier, put it on offer, or stop ordering it. Most money first.
 */
export function deadStock(
  medicines: readonly Medicine[],
  batches: readonly StockBatch[],
  velocity: readonly SalesVelocity[],
  days: number,
  now = new Date(),
): { rows: DeadStockRow[]; costPaise: Paise } {
  const byId = new Map(medicines.map((m) => [m.id, m]));
  const last = new Map(velocity.map((v) => [v.medicineId, v.lastSoldAt]));
  const cutoff = now.getTime() - days * DAY;
  const rows: DeadStockRow[] = [];
  for (const [id, s] of stockByMedicine(batches, byId, now)) {
    const m = byId.get(id)!;
    if (m.status !== "active") continue;
    const lastSoldAt = last.get(id) ?? null;
    const lastMs = lastSoldAt ? Date.parse(lastSoldAt) : null;
    if (lastMs !== null && lastMs >= cutoff) continue;
    // Stocked recently and simply not sold YET — not dead
    if (lastMs === null && Date.parse(s.since) >= cutoff) continue;
    rows.push({
      medicineId: id,
      name: m.name,
      brand: m.brand,
      packs: round1(s.packs),
      unit: m.unit,
      costPaise: s.costPaise,
      lastSoldAt,
      idleDays:
        lastMs === null ? null : Math.floor((now.getTime() - lastMs) / DAY),
      nearestExpiry: s.nearestExpiry,
    });
  }
  rows.sort((a, b) => b.costPaise - a.costPaise);
  return { rows, costPaise: rows.reduce((a, r) => a + r.costPaise, 0) };
}

/* ------------------------------------------------------------------ */
/* What to order                                                       */
/* ------------------------------------------------------------------ */

export type OrderRow = {
  medicineId: string;
  name: string;
  brand: string;
  unit: string;
  /** Packs sold in the window */
  soldPacks: number;
  /** Average packs a day */
  perDay: number;
  /** Sellable now (expiring within the cover period doesn't count) */
  inStockPacks: number;
  /** Days the current stock lasts at this speed (null = not selling) */
  daysLeft: number | null;
  /** Whole packs to order */
  orderPacks: number;
  /** At the last purchase price (landed) */
  estCostPaise: Paise;
  /** Supplier of the last purchase, "" = never purchased */
  lastSupplier: string;
  /** Its id ("" = never purchased) — to send the order to that supplier */
  lastSupplierId: string;
  reason: "selling" | "below_min";
};

/**
 * Enough for the next `coverDays` at the speed of the last `days` —
 * and never below the minimum stock set on the medicine. Stock that
 * expires before it would be sold isn't counted.
 */
export function orderList(
  medicines: readonly Medicine[],
  batches: readonly StockBatch[],
  velocity: readonly SalesVelocity[],
  purchases: readonly Purchase[],
  opts: { days: number; coverDays: number },
  now = new Date(),
): { rows: OrderRow[]; estCostPaise: Paise } {
  const byId = new Map(medicines.map((m) => [m.id, m]));
  const sold = new Map(velocity.map((v) => [v.medicineId, v.soldPacks]));

  // Usable for the cover period: not expired, not expiring before it's sold
  const usable = new Map<string, number>();
  const lastCost = new Map<string, { at: string; paise: Paise }>();
  for (const b of batches) {
    const m = byId.get(b.medicineId);
    if (!m) continue;
    const cost = { at: b.receivedAt, paise: rupeesToPaise(b.purchasePrice) };
    const prev = lastCost.get(m.id);
    if (!prev || cost.at > prev.at) lastCost.set(m.id, cost);
    if (
      isExpiryPast(b.expiry, now) ||
      isExpiringWithin(b.expiry, opts.coverDays, now)
    )
      continue;
    usable.set(m.id, (usable.get(m.id) ?? 0) + batchPacks(b, m));
  }

  // Who supplied it last
  const supplier = new Map<string, { at: string; name: string; id: string }>();
  for (const p of purchases) {
    if (p.status !== "active") continue;
    for (const l of p.lines) {
      const prev = supplier.get(l.medicineId);
      if (!prev || p.invoiceDate > prev.at)
        supplier.set(l.medicineId, {
          at: p.invoiceDate,
          name: p.supplierName,
          id: p.supplierId,
        });
    }
  }

  const rows: OrderRow[] = [];
  for (const m of medicines) {
    if (m.status !== "active") continue;
    const soldPacks = Math.max(0, sold.get(m.id) ?? 0);
    const perDay = soldPacks / opts.days;
    const have = usable.get(m.id) ?? 0;
    const need = Math.max(perDay * opts.coverDays, m.minStock);
    const orderPacks = Math.ceil(need - have - 1e-9);
    if (orderPacks <= 0) continue;
    rows.push({
      medicineId: m.id,
      name: m.name,
      brand: m.brand,
      unit: m.unit,
      soldPacks: round1(soldPacks),
      perDay: Math.round(perDay * 100) / 100,
      inStockPacks: round1(have),
      daysLeft: perDay > 0 ? Math.floor(have / perDay) : null,
      orderPacks,
      estCostPaise: orderPacks * (lastCost.get(m.id)?.paise ?? 0),
      lastSupplier: supplier.get(m.id)?.name ?? "",
      lastSupplierId: supplier.get(m.id)?.id ?? "",
      reason: perDay * opts.coverDays >= m.minStock ? "selling" : "below_min",
    });
  }
  // Running out soonest first
  rows.sort(
    (a, b) =>
      (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity) ||
      b.soldPacks - a.soldPacks,
  );
  return { rows, estCostPaise: rows.reduce((a, r) => a + r.estCostPaise, 0) };
}

/** The order as a WhatsApp message for the distributor */
export function orderText(
  rows: readonly OrderRow[],
  shop: WhatsAppShop | string,
  date = new Date(),
): string {
  const s = typeof shop === "string" ? { name: shop } : shop;
  const d = date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return waJoin([
    "🛒 *PURCHASE ORDER*",
    ...waShopHeader(s),
    `📅 ${d}`,
    WA_LINE,
    ...rows.map(
      (r, i) => `${waNumber(i)} *${r.name}* — ${r.orderPacks} ${r.unit}`,
    ),
    WA_LINE,
    `📦 *Total items: ${rows.length}*`,
    "🙏 Please confirm availability, rate & delivery time.",
    ...waShopFooter(s),
  ]);
}

/* ------------------------------------------------------------------ */
/* Profit by medicine / company                                        */
/* ------------------------------------------------------------------ */

export type ProfitRow = {
  key: string;
  name: string;
  /** Company (medicine rows) or number of medicines (company rows) */
  detail: string;
  soldPacks: number;
  salesPaise: Paise;
  costPaise: Paise;
  profitPaise: Paise;
  /** Profit as % of sales */
  marginPct: number;
};

/**
 * Sales − landed cost of the exact batches sold (FEFO allocations), per
 * medicine and per company, for bills in the period. Before customer
 * returns — same as the "Estimated margin" card.
 */
/** What the batches actually sold on one bill line cost (purchase price) */
export function lineCostPaise(
  l: Sale["lines"][number],
  costOf: ReadonlyMap<string, number>,
): Paise {
  const ups = l.unitsPerStrip > 0 ? l.unitsPerStrip : 1;
  let cost = 0;
  for (const a of l.allocations)
    cost += Math.round(
      (a.qtyStrip + a.qtyLoose / ups) *
        rupeesToPaise(costOf.get(a.batchId) ?? 0),
    );
  return cost;
}

export function profitBy(
  sales: readonly Sale[],
  batches: readonly StockBatch[],
  medicines: readonly Medicine[],
  range: DateRange,
): { medicines: ProfitRow[]; companies: ProfitRow[] } {
  const costOf = new Map(batches.map((b) => [b.id, b.purchasePrice]));
  const brandOf = new Map(medicines.map((m) => [m.id, m.brand]));
  const meds = new Map<string, ProfitRow>();
  for (const s of sales) {
    if (!inRange(s.createdAt, range)) continue;
    for (const l of s.lines) {
      const ups = l.unitsPerStrip > 0 ? l.unitsPerStrip : 1;
      const cost = lineCostPaise(l, costOf);
      const r = meds.get(l.medicineId) ?? {
        key: l.medicineId,
        name: l.medicineName,
        detail: brandOf.get(l.medicineId) || l.brand || "—",
        soldPacks: 0,
        salesPaise: 0,
        costPaise: 0,
        profitPaise: 0,
        marginPct: 0,
      };
      r.soldPacks +=
        l.unit === "LSE" ? l.qtyLoose : l.qtyStrip + l.qtyLoose / ups;
      r.salesPaise += l.amountPaise;
      r.costPaise += cost;
      meds.set(l.medicineId, r);
    }
  }
  const finish = (r: ProfitRow): ProfitRow => {
    const profitPaise = r.salesPaise - r.costPaise;
    return {
      ...r,
      soldPacks: round1(r.soldPacks),
      profitPaise,
      marginPct: r.salesPaise
        ? Math.round((profitPaise / r.salesPaise) * 1000) / 10
        : 0,
    };
  };
  const medicineRows = [...meds.values()].map(finish);
  const comp = new Map<string, ProfitRow & { count: number }>();
  for (const r of medicineRows) {
    const c = comp.get(r.detail) ?? {
      key: r.detail,
      name: r.detail,
      detail: "",
      count: 0,
      soldPacks: 0,
      salesPaise: 0,
      costPaise: 0,
      profitPaise: 0,
      marginPct: 0,
    };
    c.count++;
    c.soldPacks += r.soldPacks;
    c.salesPaise += r.salesPaise;
    c.costPaise += r.costPaise;
    comp.set(r.detail, c);
  }
  const byProfit = (a: ProfitRow, b: ProfitRow) =>
    b.profitPaise - a.profitPaise;
  return {
    medicines: medicineRows.sort(byProfit),
    companies: [...comp.values()]
      .map(({ count, ...c }) =>
        finish({
          ...c,
          detail: count === 1 ? "1 medicine" : `${count} medicines`,
        }),
      )
      .sort(byProfit),
  };
}
