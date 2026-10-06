import { create } from "zustand";
import { ApiError } from "@/lib/api";
import { useMedicineStore } from "@/features/medicines/store/useMedicineStore";

/**
 * Connection to the server, and loading what has moved to it so far.
 * Step 6: the medicine list. Other screens still use demo data and move
 * over one by one in the next steps.
 */
type ServerStatus = "checking" | "online" | "offline";

type ServerState = {
  status: ServerStatus;
  error: string | null;
  lastSyncAt: number | null;
  sync: () => Promise<void>;
};

export const useServerStore = create<ServerState>()((set, get) => ({
  status: "checking",
  error: null,
  lastSyncAt: null,

  sync: async () => {
    if (get().status === "checking" && get().lastSyncAt !== null) return; // already running
    set({ status: "checking" });
    try {
      await useMedicineStore.getState().loadFromServer();
      set({ status: "online", error: null, lastSyncAt: Date.now() });
    } catch (err) {
      set({
        status: "offline",
        error:
          err instanceof ApiError
            ? err.message
            : "Could not load from the server",
      });
    }
  },
}));
