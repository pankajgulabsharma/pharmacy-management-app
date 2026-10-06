import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DEFAULT_SETTINGS } from "@medicare/domain/settings/defaults";
import { sanitizeSettings } from "@medicare/domain/settings/validation";
import type {
  BillingPrefs,
  InventoryPrefs,
  Settings,
  ShopProfile,
} from "@medicare/domain/settings/types";

/**
 * Shop settings. Unlike business data these are remembered in the browser:
 * they are not secret (they are printed on every bill) and must survive a
 * refresh. Everything read back is passed through sanitizeSettings(), so
 * edited or corrupted storage can never put invalid values into the app.
 * TODO(api): move to the backend so all counters share one copy.
 */
type SettingsState = Settings & {
  updateShop: (shop: ShopProfile) => void;
  updateBilling: (billing: BillingPrefs) => void;
  updateInventory: (inventory: InventoryPrefs) => void;
  setDoctors: (doctors: string[]) => void;
  setCounters: (counters: string[]) => void;
  resetToDefaults: () => void;
};

/** Apply a change, then re-validate the whole object (never trust callers) */
function apply(current: Settings, patch: Partial<Settings>): Settings {
  return sanitizeSettings({ ...current, ...patch });
}

function pick(s: SettingsState): Settings {
  return {
    shop: s.shop,
    billing: s.billing,
    inventory: s.inventory,
    doctors: s.doctors,
    counters: s.counters,
  };
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_SETTINGS,
      updateShop: (shop) => set(apply(pick(get()), { shop })),
      updateBilling: (billing) => set(apply(pick(get()), { billing })),
      updateInventory: (inventory) => set(apply(pick(get()), { inventory })),
      setDoctors: (doctors) => set(apply(pick(get()), { doctors })),
      setCounters: (counters) => set(apply(pick(get()), { counters })),
      resetToDefaults: () => set(sanitizeSettings(DEFAULT_SETTINGS)),
    }),
    {
      name: "medicare-settings",
      version: 1,
      // No browser storage in tests / SSR — settings simply aren't remembered there
      storage:
        typeof window !== "undefined"
          ? createJSONStorage(() => window.localStorage)
          : undefined,
      partialize: (s) => pick(s),
      // Validate whatever comes back from storage before it reaches the app
      merge: (persisted, current) => ({
        ...current,
        ...sanitizeSettings(persisted),
      }),
    },
  ),
);

/* Read-outside-React helpers (pure utils use these as defaults) */
export const getExpiringSoonDays = () =>
  useSettingsStore.getState().inventory.expiringSoonDays;
export const getPurchaseShortExpiryMonths = () =>
  useSettingsStore.getState().inventory.purchaseShortExpiryMonths;
