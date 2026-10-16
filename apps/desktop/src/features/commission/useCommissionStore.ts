import { create } from "zustand";
import {
  DEFAULT_RATES,
  type CommissionKind,
  type CommissionPayout,
  type CommissionRates,
} from "@medicare/domain/reports/commission";
import { apiGet, apiRequest } from "@/lib/api";

type Store = {
  rates: CommissionRates;
  payouts: CommissionPayout[];
  loaded: boolean;
  /** Owner only (the server says no to anyone else) */
  load: () => Promise<void>;
  saveRates: (rates: CommissionRates) => Promise<void>;
  addPayout: (p: {
    kind: CommissionKind;
    name: string;
    from: string;
    to: string;
    amountPaise: number;
    note?: string;
  }) => Promise<void>;
  removePayout: (id: string) => Promise<void>;
};

/**
 * Doctor referrals & staff commission: rates + payouts. Reloads by itself
 * when the owner changes them on another counter (topic "commission").
 */
export const useCommissionStore = create<Store>()((set, get) => ({
  rates: DEFAULT_RATES,
  payouts: [],
  loaded: false,
  load: async () => {
    const r = await apiGet<{
      rates: CommissionRates;
      payouts: CommissionPayout[];
    }>("/api/commission");
    set({ rates: r.rates, payouts: r.payouts, loaded: true });
  },
  saveRates: async (rates) => {
    const r = await apiRequest<{ rates: CommissionRates }>(
      "PUT",
      "/api/commission/rates",
      rates,
    );
    set({ rates: r.rates });
  },
  addPayout: async (p) => {
    const r = await apiRequest<{ payout: CommissionPayout }>(
      "POST",
      "/api/commission/payouts",
      p,
    );
    set({ payouts: [r.payout, ...get().payouts] });
  },
  removePayout: async (id) => {
    await apiRequest(
      "DELETE",
      `/api/commission/payouts/${encodeURIComponent(id)}`,
    );
    set({ payouts: get().payouts.filter((x) => x.id !== id) });
  },
}));
