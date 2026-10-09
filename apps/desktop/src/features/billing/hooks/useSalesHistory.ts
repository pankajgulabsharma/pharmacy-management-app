import { useEffect, useMemo, useState } from "react";
import type { Sale, SaleReturn } from "@medicare/domain/billing/types";
import type { DateRange } from "@medicare/domain/reports/period";
import { recentSince } from "@medicare/domain/shop/history";
import { upsertById } from "@medicare/domain/shop/patch";
import { apiGet } from "@/lib/api";
import { useSalesStore } from "../store/useSalesStore";

type Period = { sales: Sale[]; saleReturns: SaleReturn[] };

/**
 * Bills + returns for a period. Recent periods come straight from memory;
 * an older one (last year's GST, an old H1 register) is fetched once from
 * the server, and today's live bills are merged in so it stays current.
 */
export function useSalesInRange(range: DateRange): Period & {
  loading: boolean;
  error: string | null;
} {
  const sales = useSalesStore((s) => s.sales);
  const saleReturns = useSalesStore((s) => s.saleReturns);
  const inMemory = range.from >= recentSince();
  const key = inMemory
    ? ""
    : `from=${encodeURIComponent(range.from.toISOString())}&to=${encodeURIComponent(new Date(range.to.getTime() + 1).toISOString())}`;
  const [fetched, setFetched] = useState<{
    key: string;
    data: Period | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (!key) return;
    let live = true;
    apiGet<Period>(`/api/sales?${key}`).then(
      (data) => live && setFetched({ key, data, error: null }),
      (e: Error) => live && setFetched({ key, data: null, error: e.message }),
    );
    return () => {
      live = false;
    };
  }, [key]);

  return useMemo(() => {
    if (!key) return { sales, saleReturns, loading: false, error: null };
    const f = fetched?.key === key ? fetched : null;
    if (!f?.data)
      return {
        sales: [],
        saleReturns: [],
        loading: !f,
        error: f?.error ?? null,
      };
    // Newest first, like the store
    const byNewest = <T extends { createdAt: string }>(a: T, b: T) =>
      b.createdAt.localeCompare(a.createdAt);
    return {
      sales: [...upsertById(f.data.sales, sales)].sort(byNewest),
      saleReturns: [...upsertById(f.data.saleReturns, saleReturns)].sort(
        byNewest,
      ),
      loading: false,
      error: null,
    };
  }, [key, fetched, sales, saleReturns]);
}

/**
 * Bills older than what this counter keeps, found on the server by bill
 * number or customer (header search, sales return, reprint) — with their
 * returns. Debounced; only bills not already in memory.
 */
export function useOlderBills(query: string): Period {
  const sales = useSalesStore((s) => s.sales);
  const q = query.trim();
  const [found, setFound] = useState<{ q: string } & Period>({
    q: "",
    sales: [],
    saleReturns: [],
  });

  useEffect(() => {
    if (q.length < 3) return;
    let live = true;
    const t = setTimeout(() => {
      apiGet<Period>(
        `/api/sales/find?q=${encodeURIComponent(q.slice(0, 40))}`,
      ).then(
        (r) => live && setFound({ q, ...r }),
        () => live && setFound({ q, sales: [], saleReturns: [] }),
      );
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q]);

  return useMemo(() => {
    if (q.length < 3 || found.q !== q) return NONE;
    const have = new Set(sales.map((s) => s.id));
    const older = found.sales.filter((s) => !have.has(s.id));
    if (!older.length) return NONE;
    const ids = new Set(older.map((s) => s.id));
    return {
      sales: older,
      saleReturns: found.saleReturns.filter((r) => ids.has(r.saleId)),
    };
  }, [q, found, sales]);
}

const NONE: Period = { sales: [], saleReturns: [] };
