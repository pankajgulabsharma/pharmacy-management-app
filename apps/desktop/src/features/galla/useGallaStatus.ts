import { useEffect } from "react";
import { create } from "zustand";
import type { CashDay } from "@medicare/domain/cash/galla";
import { can } from "@medicare/domain/auth/permissions";
import { apiGet } from "@/lib/api";
import { useAuthStore } from "@/features/auth/store/useAuthStore";
import { useSalesStore } from "@/features/billing/store/useSalesStore";
import { useCustomerStore } from "@/features/customers/store/useCustomerStore";
import { useGallaStore, type GallaView } from "./useGallaStore";

type Status = {
  /** This counter's galla today */
  today: GallaView | null;
  /** Days before today never closed */
  open: CashDay[];
  /** Owner: recent closings that came out short */
  short: CashDay[];
  refresh: () => Promise<void>;
};

let running: Promise<void> | null = null;

/** Galla at a glance — the Dashboard tile and the bell share it */
export const useGallaStatusStore = create<Status>()((set) => ({
  today: null,
  open: [],
  short: [],
  refresh: () =>
    (running ??= Promise.all([
      apiGet<GallaView>("/api/galla"),
      apiGet<{ open: CashDay[]; short: CashDay[] }>("/api/galla/pending"),
    ])
      .then(([today, p]) => set({ today, open: p.open, short: p.short }))
      .catch(() => {})
      .finally(() => {
        running = null;
      })),
}));

/** Keeps the status fresh: on bills, returns, payments and galla saves */
export function useGallaStatus() {
  const canSell = useAuthStore((s) => can(s.session?.user.role, "sell"));
  const tick = useSalesStore((s) => s.sales.length + s.saleReturns.length);
  const pay = useCustomerStore((s) => s.payments.length);
  const galla = useGallaStore((s) => s.view);
  const refresh = useGallaStatusStore((s) => s.refresh);
  useEffect(() => {
    if (canSell) void refresh();
  }, [canSell, refresh, tick, pay, galla]);
  return useGallaStatusStore();
}
