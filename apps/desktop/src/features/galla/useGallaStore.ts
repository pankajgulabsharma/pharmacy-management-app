import { create } from "zustand";
import {
  businessDate,
  type CashDay,
  type CashEntry,
  type CashKind,
  type GallaSummary,
} from "@medicare/domain/cash/galla";
import { apiGet, apiRequest } from "@/lib/api";

export type GallaView = {
  date: string;
  counter: string;
  perCounter: boolean;
  counters: string[];
  day: CashDay | null;
  entries: CashEntry[];
  summary: GallaSummary;
  suggestedOpeningPaise: number;
  afterClosePaise: number;
};

type Store = {
  view: GallaView | null;
  /** Looking at: a day ("" = today) and, per counter, which one ("" = mine) */
  date: string;
  counter: string;
  loading: boolean;
  load: (to?: { date?: string; counter?: string }) => Promise<void>;
  open: (openingPaise: number, note?: string) => Promise<void>;
  addEntry: (e: {
    kind: CashKind;
    category: string;
    amountPaise: number;
    note: string;
  }) => Promise<void>;
  removeEntry: (id: string) => Promise<void>;
  close: (c: {
    countedPaise: number;
    keptPaise: number;
    denominations: Record<string, number>;
    note: string;
  }) => Promise<void>;
  reopen: () => Promise<void>;
};

const query = (date: string, counter: string) => {
  const q = new URLSearchParams();
  if (date) q.set("date", date);
  if (counter) q.set("counter", counter);
  const s = q.toString();
  return s ? `?${s}` : "";
};

/**
 * The galla on screen. The server works out the expected cash (from the
 * bills), so every write answers with the whole fresh view.
 */
export const useGallaStore = create<Store>()((set, get) => {
  const target = () => {
    const v = get().view;
    return {
      date: get().date || v?.date || businessDate(),
      counter: get().counter || v?.counter || undefined,
    };
  };
  const put = (view: GallaView) => set({ view, loading: false });
  return {
    view: null,
    date: "",
    counter: "",
    loading: false,
    load: async (to) => {
      if (to)
        set({
          date: to.date ?? get().date,
          counter: to.counter ?? get().counter,
        });
      set({ loading: true });
      try {
        put(
          await apiGet<GallaView>(
            `/api/galla${query(get().date, get().counter)}`,
          ),
        );
      } finally {
        set({ loading: false });
      }
    },
    open: async (openingPaise, note) =>
      put(
        await apiRequest<GallaView>("POST", "/api/galla/open", {
          ...target(),
          openingPaise,
          ...(note ? { note } : {}),
        }),
      ),
    addEntry: async (e) =>
      put(
        await apiRequest<GallaView>("POST", "/api/galla/entries", {
          ...target(),
          ...e,
        }),
      ),
    removeEntry: async (id) =>
      put(
        await apiRequest<GallaView>(
          "DELETE",
          `/api/galla/entries/${encodeURIComponent(id)}`,
        ),
      ),
    close: async (c) =>
      put(
        await apiRequest<GallaView>("POST", "/api/galla/close", {
          ...target(),
          ...c,
        }),
      ),
    reopen: async () => {
      const id = get().view?.day?.id;
      if (!id) return;
      put(
        await apiRequest<GallaView>(
          "POST",
          `/api/galla/days/${encodeURIComponent(id)}/reopen`,
        ),
      );
    },
  };
});
