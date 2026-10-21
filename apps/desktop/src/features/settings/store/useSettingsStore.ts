import { create } from "zustand";
import { DEFAULT_SETTINGS } from "@medicare/domain/settings/defaults";
import { sanitizeSettings } from "@medicare/domain/settings/validation";
import type {
  BillingPrefs,
  InventoryPrefs,
  Settings,
  ShopProfile,
} from "@medicare/domain/settings/types";
import type { RoleAccess } from "@medicare/domain/auth/permissions";
import { apiGet, apiRequest } from "@/lib/api";

/**
 * Shop settings — ONE copy on the server, shared by every counter.
 * The owner saves (the server checks it with the same rules), and every
 * open app gets the new values at once ("settings changed" event).
 * Until the first load, defaults are shown.
 */
type SettingsState = Settings & {
  loadFromServer: () => Promise<void>;
  updateShop: (shop: ShopProfile) => Promise<void>;
  updateBilling: (billing: BillingPrefs) => Promise<void>;
  updateInventory: (inventory: InventoryPrefs) => Promise<void>;
  /** The doctors list (+ their details when given) */
  setDoctors: (
    doctors: string[],
    doctorInfo?: Settings["doctorInfo"],
  ) => Promise<void>;
  setCounters: (counters: string[]) => Promise<void>;
  setRoles: (roles: RoleAccess) => Promise<void>;
  resetToDefaults: () => Promise<void>;
};

/** Send a change; show what the server saved (it may clean values) */
async function save(change: Partial<Settings>) {
  const r = await apiRequest<{ settings: Settings }>(
    "PUT",
    "/api/settings",
    change,
  );
  useSettingsStore.setState(sanitizeSettings(r.settings));
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  ...DEFAULT_SETTINGS,
  loadFromServer: async () => {
    const r = await apiGet<{ settings: Settings }>("/api/settings");
    set(sanitizeSettings(r.settings));
  },
  updateShop: (shop) => save({ shop }),
  updateBilling: (billing) => save({ billing }),
  updateInventory: (inventory) => save({ inventory }),
  setDoctors: (doctors, doctorInfo) =>
    save(doctorInfo ? { doctors, doctorInfo } : { doctors }),
  setCounters: (counters) => save({ counters }),
  setRoles: (roles) => save({ roles }),
  // The shop's own details (name, address, GSTIN, licence) are kept
  resetToDefaults: () =>
    save({ ...DEFAULT_SETTINGS, shop: get().shop }),
}));

/* Read-outside-React helpers (pure utils use these as defaults) */
export const getExpiringSoonDays = () =>
  useSettingsStore.getState().inventory.expiringSoonDays;
export const getPurchaseShortExpiryMonths = () =>
  useSettingsStore.getState().inventory.purchaseShortExpiryMonths;
