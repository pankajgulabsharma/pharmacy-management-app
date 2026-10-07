import { create } from "zustand";
import { API_URL, ApiError } from "@/lib/api";
import { useMedicineStore } from "@/features/medicines/store/useMedicineStore";
import { useSupplierStore } from "@/features/suppliers/store/useSupplierStore";

/**
 * Live connection to the server — screens update by themselves, no refresh.
 *
 *  • On connect: load everything that lives on the server.
 *  • The server announces every save ("medicines changed") over one open
 *    stream → only that part reloads, on this and every other counter.
 *  • Stream drops (server stopped) → light turns red; the browser retries
 *    every 3 s and everything reloads the moment it is back.
 *  • Coming back to the app (window focus) also reloads — that catches
 *    changes made outside the app (Drizzle Studio, sqlite3).
 */
type ServerStatus = "checking" | "online" | "offline";
type Topic = "medicines" | "suppliers";

/** Who reloads for each topic the server announces */
const LOADERS: Record<Topic, () => Promise<void>> = {
  medicines: () => useMedicineStore.getState().loadFromServer(),
  suppliers: () => useSupplierStore.getState().loadFromServer(),
};

type ServerState = {
  status: ServerStatus;
  error: string | null;
  lastSyncAt: number | null;
  /** Load everything now (also the Retry button) */
  sync: () => Promise<void>;
  /** Open the live stream once, when the app starts */
  connect: () => void;
};

let inFlight: Promise<void> | null = null;
let stream: EventSource | null = null;

export const useServerStore = create<ServerState>()((set, get) => ({
  status: "checking",
  error: null,
  lastSyncAt: null,

  sync: () => {
    inFlight ??= (async () => {
      set({ status: "checking" });
      try {
        await Promise.all(Object.values(LOADERS).map((load) => load()));
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
    if (stream) return;
    stream = new EventSource(`${API_URL}/api/events`);
    stream.onopen = () => void get().sync(); // (re)connected → fresh data
    stream.onerror = () => {
      if (stream?.readyState !== EventSource.OPEN) {
        set({ status: "offline", error: "Server not reachable" });
      }
    };
    stream.addEventListener("change", (e) => {
      const topic = (
        JSON.parse((e as MessageEvent<string>).data) as { topic?: Topic }
      ).topic;
      const load = topic ? LOADERS[topic] : undefined;
      load?.().catch(() => void get().sync());
    });
    window.addEventListener("focus", () => {
      if (get().status === "online") void get().sync();
    });
  },
}));
