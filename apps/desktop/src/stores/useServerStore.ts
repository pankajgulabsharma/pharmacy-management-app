import { create } from "zustand";
import { API_URL, ApiError, apiToken } from "@/lib/api";
import { useAuthStore } from "@/features/auth/store/useAuthStore";
import { useSettingsStore } from "@/features/settings/store/useSettingsStore";
import { useUserStore } from "@/features/settings/store/useUserStore";
import { useLicenseStore } from "@/features/license/useLicenseStore";
import { useMedicineStore } from "@/features/medicines/store/useMedicineStore";
import { useSupplierStore } from "@/features/suppliers/store/useSupplierStore";
import { useInventoryStore } from "@/features/inventory/store/useInventoryStore";
import { usePurchaseStore } from "@/features/purchases/store/usePurchaseStore";
import { useSalesStore } from "@/features/billing/store/useSalesStore";
import { useCustomerStore } from "@/features/customers/store/useCustomerStore";
import type { ShopPatch } from "@medicare/domain/shop/patch";
import { applyShopPatch } from "./applyShopPatch";

/**
 * Live connection to the server — screens update by themselves, no refresh.
 *
 *  • Opened after sign-in (the stream needs your token), closed on sign-out.
 *  • On connect: load everything that lives on the server.
 *  • The server announces every save over one open stream: masters
 *    ("medicines changed") reload; bills/purchases/returns arrive as a
 *    patch of just what changed — on this and every other counter.
 *  • Stream drops (server stopped) → light turns red; the browser retries
 *    every 3 s and everything reloads the moment it is back.
 *  • Coming back to the app (window focus) also reloads — that catches
 *    changes made outside the app (Drizzle Studio, sqlite3).
 */
type ServerStatus = "checking" | "online" | "offline";
type Topic = "medicines" | "suppliers" | "settings" | "users" | "license";

/** Who reloads for each topic the server announces */
const LOADERS: Record<Topic, () => Promise<void>> = {
  medicines: () => useMedicineStore.getState().loadFromServer(),
  suppliers: () => useSupplierStore.getState().loadFromServer(),
  settings: () => useSettingsStore.getState().loadFromServer(),
  license: () => useLicenseStore.getState().loadFromServer(),
  // My role may have changed; the owner's Users screen refreshes too
  users: async () => {
    await useAuthStore.getState().refreshMe();
    const users = useUserStore.getState();
    if (users.loaded) await users.load();
  },
};

/** Stock & money: loaded on connect; after that, other counters' saves arrive as patches */
const SHOP_LOADERS = [
  () => useInventoryStore.getState().loadFromServer(),
  () => usePurchaseStore.getState().loadFromServer(),
  () => useSalesStore.getState().loadFromServer(),
  () => useCustomerStore.getState().loadFromServer(),
];

type ServerState = {
  status: ServerStatus;
  error: string | null;
  lastSyncAt: number | null;
  /** Load everything now (also the Retry button) */
  sync: () => Promise<void>;
  /** Open the live stream (after sign-in) */
  connect: () => void;
  /** Close it (sign-out) — the next person starts from a fresh load */
  disconnect: () => void;
};

let inFlight: Promise<void> | null = null;
let stream: EventSource | null = null;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let focusHooked = false;

function closeStream() {
  clearTimeout(retryTimer);
  stream?.close();
  stream = null;
}

export const useServerStore = create<ServerState>()((set, get) => ({
  status: "checking",
  error: null,
  lastSyncAt: null,

  sync: () => {
    inFlight ??= (async () => {
      set({ status: "checking" });
      try {
        await Promise.all(
          [...Object.values(LOADERS), ...SHOP_LOADERS].map((load) => load()),
        );
        set({ status: "online", error: null, lastSyncAt: Date.now() });
      } catch (err) {
        set({
          status: "offline",
          error:
            err instanceof ApiError
              ? err.message
              : "Could not load from the server",
        });
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  },

  connect: () => {
    // No live stream in this environment (tests) → plain one-time load
    if (typeof EventSource === "undefined") {
      void get().sync();
      return;
    }
    const token = apiToken();
    if (stream || !token) return;
    stream = new EventSource(
      `${API_URL}/api/events?token=${encodeURIComponent(token)}`,
    );
    stream.onopen = () => void get().sync(); // (re)connected → fresh data
    stream.onerror = () => {
      if (stream?.readyState === EventSource.OPEN) return;
      set({ status: "offline", error: "Server not reachable" });
      // Refused (e.g. signed out elsewhere) → the browser gives up; we retry.
      // A 401 on the next load signs this app out (and closes the stream).
      if (stream?.readyState === EventSource.CLOSED) {
        // Only the stream is reopened — screens (and a half-made bill) stay
        closeStream();
        retryTimer = setTimeout(() => {
          if (!apiToken()) return; // signed out meanwhile
          void get().sync();
          get().connect();
        }, 3000);
      }
    };
    stream.addEventListener("change", (e) => {
      const topic = (
        JSON.parse((e as MessageEvent<string>).data) as {
          topic?: Topic | "all";
        }
      ).topic;
      // "all" = a backup was restored → reload everything
      if (topic === "all") return void get().sync();
      const load = topic ? LOADERS[topic] : undefined;
      load?.().catch(() => void get().sync());
    });
    // A bill / purchase / return saved on any counter → merge what changed
    stream.addEventListener("patch", (e) => {
      try {
        applyShopPatch(
          JSON.parse((e as MessageEvent<string>).data) as ShopPatch,
        );
      } catch {
        void get().sync();
      }
    });
    if (!focusHooked) {
      focusHooked = true;
      window.addEventListener("focus", () => {
        if (stream && get().status === "online") void get().sync();
      });
    }
  },

  disconnect: () => {
    closeStream();
    set({ status: "checking", error: null, lastSyncAt: null });
  },
}));
