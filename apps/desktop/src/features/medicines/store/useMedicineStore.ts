import { create } from "zustand";
import {
  cleanMedicineInput,
  MAX_MEDICINE_IMPORT,
} from "@medicare/domain/medicines/clean";
import { apiGet, apiRequest, requireServer } from "@/lib/api";
import type { Medicine, MedicineInput } from "@medicare/domain/medicines/types";

/**
 * Medicine master (catalogue). The database (server) is the source of truth:
 * every change is sent to the server first, and the screen shows what the
 * server actually saved. Without a server connection, changes are refused —
 * never "saved" on screen and lost on refresh.
 */
type MedicineState = {
  medicines: Medicine[];
  /** "server" once loaded from the database; "none" until then */
  source: "none" | "server";
  /** Replace the list with the server's (database) list */
  loadFromServer: () => Promise<void>;
  addMedicine: (input: MedicineInput) => Promise<Medicine>;
  updateMedicine: (id: string, input: MedicineInput) => Promise<Medicine>;
  /** The server refuses if the medicine has stock or history */
  removeMedicine: (id: string) => Promise<void>;
  importMedicines: (rows: readonly MedicineInput[]) => Promise<number>;
};

export const useMedicineStore = create<MedicineState>()((set, get) => ({
  medicines: [],
  source: "none",

  loadFromServer: async () => {
    const { items } = await apiGet<{ items: Medicine[] }>("/api/medicines");
    if (!Array.isArray(items))
      throw new Error("Unexpected answer from the server");
    set({ medicines: items, source: "server" });
  },

  addMedicine: async (input) => {
    requireServer(get().source);
    const saved = await apiRequest<Medicine>(
      "POST",
      "/api/medicines",
      cleanMedicineInput(input),
    );
    set((s) => ({ medicines: [saved, ...s.medicines] }));
    return saved;
  },

  updateMedicine: async (id, input) => {
    requireServer(get().source);
    const saved = await apiRequest<Medicine>(
      "PUT",
      `/api/medicines/${encodeURIComponent(id)}`,
      cleanMedicineInput(input),
    );
    set((s) => ({
      medicines: s.medicines.map((m) => (m.id === id ? saved : m)),
    }));
    return saved;
  },

  removeMedicine: async (id) => {
    requireServer(get().source);
    await apiRequest<void>(
      "DELETE",
      `/api/medicines/${encodeURIComponent(id)}`,
    );
    set((s) => ({ medicines: s.medicines.filter((m) => m.id !== id) }));
  },

  importMedicines: async (rows) => {
    requireServer(get().source);
    const { items } = await apiRequest<{ items: Medicine[] }>(
      "POST",
      "/api/medicines/import",
      {
        rows: rows.slice(0, MAX_MEDICINE_IMPORT).map(cleanMedicineInput),
      },
    );
    set((s) => ({ medicines: [...items, ...s.medicines] }));
    return items.length;
  },
}));
