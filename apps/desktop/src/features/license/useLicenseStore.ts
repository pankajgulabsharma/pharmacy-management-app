import { create } from "zustand";
import { apiGet, apiRequest } from "@/lib/api";
import {
  hasFeature,
  type Feature,
  type Plan,
} from "@medicare/domain/license/plan";

/** Same shape as the server's licence state (apps/server/src/license/state.ts) */
export type LicenseState = {
  status: "off" | "trial" | "active" | "grace" | "expired" | "clock";
  canWork: boolean;
  daysLeft: number | null;
  message: string;
  machine: string;
  license: {
    id: string;
    shop: string;
    machine: string;
    issuedAt: string;
    expiresAt: string;
    counters: number;
    plan?: Plan;
  } | null;
  counters: number | null;
  plan: Plan;
};

type Store = {
  state: LicenseState | null;
  loadFromServer: () => Promise<void>;
  /** Owner pastes the key from the provider */
  saveKey: (key: string) => Promise<LicenseState>;
};

/**
 * Licence status of this shop. The SERVER decides (trial, active, on hold);
 * the app only shows it — banner, bell, Settings → Licence.
 */
export const useLicenseStore = create<Store>()((set) => ({
  state: null,
  loadFromServer: async () => {
    set({ state: await apiGet<LicenseState>("/api/license") });
  },
  saveKey: async (key) => {
    const state = await apiRequest<LicenseState>("POST", "/api/license", {
      key,
    });
    set({ state });
    return state;
  },
}));

/** The shop's plan (everything until the licence is known — no flicker) */
export function usePlan() {
  const plan = useLicenseStore((s) => s.state?.plan ?? "multi");
  return { plan, has: (f: Feature) => hasFeature(plan, f) };
}
