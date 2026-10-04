import { useMemo } from "react";
import type { StockBatch } from "@/features/inventory/types";
import { useInventoryStore } from "@/features/inventory/store/useInventoryStore";
import { useMedicineStore } from "@/features/medicines/store/useMedicineStore";
import { useSettingsStore } from "@/features/settings/store/useSettingsStore";
import type { Medicine } from "@/features/medicines/types";
import { medicineMatchesQuery } from "@/features/medicines/utils/search";
import { isExpiringWithin, isExpiryPast } from "@/lib/expiry";
import { rupeesToPaise } from "@/lib/money";
import {
  type BatchAllocation,
  type CartLine,
  type LineAmounts,
} from "../types";
import {
  allocateFefo,
  batchRatePaise,
  sellableBatches,
  stockLimits,
  unitsPerPack,
  type StockLimits,
} from "../utils/allocate";
import { calcSaleTotals, priceLine } from "../utils/pricing";
import { validateCartLine } from "../utils/sale";

/* ------------------------------------------------------------------ */
/* Search                                                             */
/* ------------------------------------------------------------------ */

export type SellableItem = {
  medicine: Medicine;
  /** Earliest-expiry sellable batch (what will be sold first) */
  nextBatch: StockBatch | null;
  /** Sellable stock (expired batches excluded) */
  limits: StockLimits;
  /** Packs sitting in expired batches — shown as a warning, never sold */
  expiredStrip: number;
  ratePaise: number;
  mrpPaise: number;
};

const MAX_RESULTS = 50;

/** Live search over active medicines (name, salt, brand, barcode, batch no.) */
export function useSellableSearch(query: string): SellableItem[] {
  const medicines = useMedicineStore((s) => s.medicines);
  const batches = useInventoryStore((s) => s.batches);

  // Group batches once per stock change, not per keystroke
  const byMedicine = useMemo(() => {
    const map = new Map<string, StockBatch[]>();
    for (const b of batches) {
      const list = map.get(b.medicineId);
      if (list) list.push(b);
      else map.set(b.medicineId, [b]);
    }
    return map;
  }, [batches]);

  return useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    const now = new Date();
    const qUpper = q.toUpperCase();
    const out: SellableItem[] = [];

    for (const m of medicines) {
      if (m.status !== "active") continue;
      const own = byMedicine.get(m.id) ?? [];
      const batchHit = own.some((b) => b.batchNo.includes(qUpper));
      if (!batchHit && !medicineMatchesQuery(m, q)) continue;

      const sellable = sellableBatches(own, m.id, now);
      const next = sellable[0] ?? null;
      let expiredStrip = 0;
      for (const b of own)
        if (isExpiryPast(b.expiry, now))
          expiredStrip += b.qtyStrip + b.qtyLoose;

      out.push({
        medicine: m,
        nextBatch: next,
        limits: stockLimits(sellable, m, 0),
        expiredStrip,
        ratePaise: next ? batchRatePaise(m, next) : rupeesToPaise(m.salePrice),
        mrpPaise: next ? rupeesToPaise(next.mrp) : rupeesToPaise(m.mrp),
      });
      if (out.length >= MAX_RESULTS) break;
    }

    /*
     * Ranking — what the cashier most likely means comes first, so Enter
     * picks the right medicine:
     *   1. name starts with the query   ("vit" → Vitamin C)
     *   2. a word in the name starts with it
     *   3. matched only by salt / brand / barcode / batch
     * then in-stock before out-of-stock, then alphabetical.
     */
    const ql = q.toLowerCase();
    const rank = (name: string) => {
      const n = name.toLowerCase();
      if (n.startsWith(ql)) return 0;
      if (n.split(/\s+/).some((w) => w.startsWith(ql)) || n.includes(ql))
        return 1;
      return 2;
    };
    const stockRank = (x: SellableItem) =>
      x.limits.maxStrip + x.limits.maxLoose > 0 ? 0 : 1;
    return out.sort(
      (a, b) =>
        rank(a.medicine.name) - rank(b.medicine.name) ||
        stockRank(a) - stockRank(b) ||
        a.medicine.name.localeCompare(b.medicine.name),
    );
  }, [query, medicines, byMedicine]);
}

/* ------------------------------------------------------------------ */
/* Bill (cart → live allocation + prices)                              */
/* ------------------------------------------------------------------ */

export type BillLineView = {
  line: CartLine;
  medicine: Medicine | null;
  limits: StockLimits;
  allocations: BatchAllocation[];
  amounts: LineAmounts;
  /** Any problem that blocks saving (stock changed, medicine inactive…) */
  error: string | null;
  /** Some of it comes from a batch expiring soon */
  shortExpiry: boolean;
};

const ZERO: LineAmounts = {
  grossPaise: 0,
  discountPaise: 0,
  amountPaise: 0,
  taxablePaise: 0,
  gstPaise: 0,
};

/**
 * Re-computed from LIVE stock on every change, so a held bill resumed
 * later, or stock sold at another counter, is caught before saving.
 */
export function useBillView(cart: readonly CartLine[]) {
  const medicines = useMedicineStore((s) => s.medicines);
  const batches = useInventoryStore((s) => s.batches);
  const expiringSoonDays = useSettingsStore(
    (s) => s.inventory.expiringSoonDays,
  );

  return useMemo(() => {
    const now = new Date();
    const byId = new Map(medicines.map((m) => [m.id, m]));
    const lines: BillLineView[] = cart.map((line) => {
      const m = byId.get(line.medicineId) ?? null;
      if (!m) {
        return {
          line,
          medicine: null,
          limits: { maxStrip: 0, maxLoose: 0 },
          allocations: [],
          amounts: ZERO,
          error: "Medicine no longer exists",
          shortExpiry: false,
        };
      }
      const sellable = sellableBatches(batches, m.id, now);
      const limits = stockLimits(sellable, m, line.qtyStrip);
      const { allocations, shortStrip, shortLoose } = allocateFefo(
        sellable,
        m,
        line.qtyStrip,
        line.qtyLoose,
      );
      const ruleError = validateCartLine(line, m);
      const stockError =
        shortStrip > 0 || shortLoose > 0
          ? `Only ${limits.maxStrip} ${m.unit} in stock`
          : null;
      return {
        line,
        medicine: m,
        limits,
        allocations,
        amounts: priceLine(
          allocations,
          unitsPerPack(m),
          line.discountPercent,
          m.gstPercent,
        ),
        error: stockError ?? ruleError,
        shortExpiry: allocations.some((a) =>
          isExpiringWithin(a.expiry, expiringSoonDays, now),
        ),
      };
    });

    return {
      lines,
      totals: calcSaleTotals(lines.map((l) => l.amounts)),
      hasErrors: lines.some((l) => l.error !== null),
    };
  }, [cart, medicines, batches, expiringSoonDays]);
}
