import { useCallback, useMemo } from "react";
import type { StockBatch } from "@medicare/domain/inventory/types";
import { useInventoryStore } from "@/features/inventory/store/useInventoryStore";
import { useMedicineStore } from "@/features/medicines/store/useMedicineStore";
import { useSettingsStore } from "@/features/settings/store/useSettingsStore";
import type { Medicine } from "@medicare/domain/medicines/types";
import { medicineSearch } from "@medicare/domain/medicines/search";
import { parseQuery } from "@medicare/domain/lib/search";
import { isExpiringWithin, isExpiryPast } from "@medicare/domain/lib/expiry";
import { rupeesToPaise } from "@medicare/domain/lib/money";
import {
  type BatchAllocation,
  type CartLine,
  type LineAmounts,
} from "@medicare/domain/billing/types";
import {
  allocateFefo,
  batchRatePaise,
  sellableBatches,
  stockLimits,
  unitsPerPack,
  type StockLimits,
} from "@medicare/domain/billing/allocate";
import { calcSaleTotals, priceLine } from "@medicare/domain/billing/pricing";
import { validateCartLine } from "@medicare/domain/billing/sale";

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

/** One medicine as the billing screen shows it (stock, next batch, price) */
function toSellable(m: Medicine, own: StockBatch[], now: Date): SellableItem {
  const sellable = sellableBatches(own, m.id, now);
  const next = sellable[0] ?? null;
  let expiredStrip = 0;
  for (const b of own)
    if (isExpiryPast(b.expiry, now)) expiredStrip += b.qtyStrip + b.qtyLoose;
  return {
    medicine: m,
    nextBatch: next,
    limits: stockLimits(sellable, m, 0),
    expiredStrip,
    ratePaise: next ? batchRatePaise(m, next) : rupeesToPaise(m.salePrice),
    mrpPaise: next ? rupeesToPaise(next.mrp) : rupeesToPaise(m.mrp),
  };
}

/**
 * A barcode scanner types the code and presses Enter within milliseconds —
 * faster than the search list updates. This finds the medicine whose
 * barcode is EXACTLY what was scanned, right now.
 */
export function useBarcodeLookup(): (code: string) => SellableItem | null {
  const medicines = useMedicineStore((s) => s.medicines);
  const batches = useInventoryStore((s) => s.batches);
  return useCallback(
    (code: string) => {
      const c = code.trim();
      if (c.length < 4) return null;
      const m = medicines.find((x) => x.status === "active" && x.barcode === c);
      if (!m) return null;
      return toSellable(
        m,
        batches.filter((b) => b.medicineId === m.id),
        new Date(),
      );
    },
    [medicines, batches],
  );
}

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

  /*
   * Ranking — what the cashier most likely means comes first, so Enter
   * picks the right medicine: name starts with it → every word in the
   * name → found by salt / brand / barcode / batch no.; then in stock
   * before out of stock, then A–Z. Cut to MAX_RESULTS only AFTER ranking.
   */
  return useMemo(() => {
    const q = parseQuery(query);
    if (!q.tokens.length) return [];
    const now = new Date();
    const code = query.trim().toUpperCase();
    const hits: { item: SellableItem; r: number }[] = [];
    for (const m of medicines) {
      if (m.status !== "active") continue;
      const own = byMedicine.get(m.id) ?? [];
      let r = medicineSearch.rank(m, q);
      if (
        r < 0 &&
        code.length >= 3 &&
        own.some((b) => b.batchNo.includes(code))
      )
        r = 2;
      if (r >= 0) hits.push({ item: toSellable(m, own, now), r });
    }
    const empty = (x: SellableItem) =>
      x.limits.maxStrip + x.limits.maxLoose > 0 ? 0 : 1;
    return hits
      .sort(
        (a, b) =>
          a.r - b.r ||
          empty(a.item) - empty(b.item) ||
          a.item.medicine.name.localeCompare(b.item.medicine.name),
      )
      .slice(0, MAX_RESULTS)
      .map((h) => h.item);
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
