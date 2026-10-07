import { create } from "zustand";
import { mockSuppliers } from "@medicare/demo/data/mockSuppliers";
import {
  assertUniqueSupplier,
  cleanSupplierInput,
} from "@medicare/domain/suppliers/clean";
import type { Supplier, SupplierInput } from "@medicare/domain/suppliers/types";
import { apiGet, apiRequest, requireServer } from "@/lib/api";

/**
 * Supplier master. The database (server) is the source of truth: every
 * change goes to the server first and the screen shows what it saved.
 * The same rules run here first (instant message) and again on the server.
 */
type SupplierState = {
  suppliers: Supplier[];
  source: "demo" | "server";
  loadFromServer: () => Promise<void>;
  addSupplier: (input: SupplierInput) => Promise<Supplier>;
  updateSupplier: (id: string, input: SupplierInput) => Promise<Supplier>;
  /** The server refuses if the supplier has invoices */
  removeSupplier: (id: string) => Promise<void>;
};

export const useSupplierStore = create<SupplierState>()((set, get) => ({
  suppliers: mockSuppliers,
  source: "demo",

  loadFromServer: async () => {
    const { items } = await apiGet<{ items: Supplier[] }>("/api/suppliers");
    if (!Array.isArray(items))
      throw new Error("Unexpected answer from the server");
    set({ suppliers: items, source: "server" });
  },

  addSupplier: async (input) => {
    requireServer(get().source);
    const clean = cleanSupplierInput(input);
    assertUniqueSupplier(get().suppliers, clean);
    const saved = await apiRequest<Supplier>("POST", "/api/suppliers", clean);
    set((s) => ({
      suppliers: [saved, ...s.suppliers.filter((x) => x.id !== saved.id)],
    }));
    return saved;
  },

  updateSupplier: async (id, input) => {
    requireServer(get().source);
    const clean = cleanSupplierInput(input);
    assertUniqueSupplier(get().suppliers, clean, id);
    const saved = await apiRequest<Supplier>(
      "PUT",
      `/api/suppliers/${encodeURIComponent(id)}`,
      clean,
    );
    set((s) => ({
      suppliers: s.suppliers.map((x) => (x.id === id ? saved : x)),
    }));
    return saved;
  },

  removeSupplier: async (id) => {
    requireServer(get().source);
    await apiRequest<void>(
      "DELETE",
      `/api/suppliers/${encodeURIComponent(id)}`,
    );
    set((s) => ({ suppliers: s.suppliers.filter((x) => x.id !== id) }));
  },
}));
