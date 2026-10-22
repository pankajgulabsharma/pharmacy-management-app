import { create } from "zustand";
import type {
  StockCount,
  StockCountLine,
} from "@medicare/domain/inventory/stockCount";
import { apiGet, apiRequest } from "@/lib/api";

type Detail = { count: StockCount; lines: StockCountLine[] };
export type CountEntry = {
  batchId: string;
  qtyStrip: number | null;
  qtyLoose: number | null;
};

type Store = {
  loaded: boolean;
  counts: StockCount[];
  racks: string[];
  /** The count on screen */
  current: Detail | null;
  /** Typed counts still on their way to the server */
  pending: number;
  loadList: () => Promise<void>;
  open: (id: string) => Promise<void>;
  close: () => void;
  start: (input: {
    racks: string[];
    includeEmpty: boolean;
    note: string;
  }) => Promise<StockCount>;
  save: (entries: CountEntry[]) => Promise<void>;
  post: () => Promise<StockCount>;
  cancel: () => Promise<void>;
};

const base = "/api/stock-counts";
const at = (id: string) => `${base}/${encodeURIComponent(id)}`;

/**
 * Stock counts. Every counter shows the same count live: a save on one
 * reaches the others through the "stock-counts" topic.
 */
export const useStockCountStore = create<Store>()((set, get) => {
  const put = (d: Detail) => {
    set({ current: d });
    // Keep the history row in step
    set((s) => ({
      counts: s.counts.some((c) => c.id === d.count.id)
        ? s.counts.map((c) => (c.id === d.count.id ? d.count : c))
        : [d.count, ...s.counts],
    }));
    return d;
  };
  return {
    loaded: false,
    counts: [],
    racks: [],
    current: null,
    pending: 0,
    loadList: async () => {
      const r = await apiGet<{ counts: StockCount[]; racks: string[] }>(base);
      set({ counts: r.counts, racks: r.racks, loaded: true });
      const cur = get().current;
      // Someone else typed or posted — follow them (but never while my
      // own typing is still being saved)
      if (cur && get().pending === 0) await get().open(cur.count.id);
    },
    open: async (id) => {
      put(await apiGet<Detail>(at(id)));
    },
    close: () => set({ current: null }),
    start: async (input) =>
      put(await apiRequest<Detail>("POST", base, input)).count,
    save: async (entries) => {
      const id = get().current?.count.id;
      if (!id || !entries.length) return;
      set((s) => ({ pending: s.pending + 1 }));
      try {
        const d = await apiRequest<Detail>("PUT", `${at(id)}/lines`, {
          lines: entries,
        });
        if (get().current?.count.id === id) put(d);
      } finally {
        set((s) => ({ pending: s.pending - 1 }));
      }
    },
    post: async () => {
      const id = get().current!.count.id;
      return put(await apiRequest<Detail>("POST", `${at(id)}/post`)).count;
    },
    cancel: async () => {
      const id = get().current!.count.id;
      put(await apiRequest<Detail>("POST", `${at(id)}/cancel`));
    },
  };
});
