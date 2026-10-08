import { create } from "zustand";
import { apiGet, apiRequest } from "@/lib/api";

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
  } | null;
  counters: number | null;
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
