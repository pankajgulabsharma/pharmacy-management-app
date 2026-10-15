import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { useSalesStore } from "@/features/billing/store/useSalesStore";
import type {
  SalesVelocity,
  VelocityWindow,
} from "@medicare/domain/reports/stockInsights";

type State = {
  key: string;
  items: SalesVelocity[] | null;
  error: string | null;
};

/**
 * How fast each medicine sells over the last `days` — worked out by the
 * server over ALL bills. Fetched again when a bill or return is saved
 * (on any counter), so the lists stay current.
 */
export function useVelocity(days: VelocityWindow) {
  const bills = useSalesStore((s) => s.sales.length + s.saleReturns.length);
  const key = `${days}|${bills}`;
  const [state, setState] = useState<State | null>(null);

  useEffect(() => {
    let alive = true;
    apiGet<{ items: SalesVelocity[] }>(`/api/reports/velocity?days=${days}`)
      .then((r) => alive && setState({ key, items: r.items, error: null }))
      .catch(
        (e: unknown) =>
          alive &&
          setState({
            key,
            items: null,
            error: e instanceof Error ? e.message : "Could not load",
          }),
      );
    return () => {
      alive = false;
    };
  }, [days, key]);

  const current = state?.key === key ? state : null;
  return {
    // Keep showing the last answer while a newer one loads
    items: current?.items ?? state?.items ?? null,
    loading: !current,
    error: current?.error ?? null,
  };
}
