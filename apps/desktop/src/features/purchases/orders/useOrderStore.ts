import { create } from "zustand";
import type {
  OrderInput,
  PurchaseOrder,
} from "@medicare/domain/purchases/orders";
import { apiGet, apiRequest } from "@/lib/api";

type Store = {
  loaded: boolean;
  orders: PurchaseOrder[];
  load: () => Promise<void>;
  create: (input: OrderInput) => Promise<PurchaseOrder>;
  update: (id: string, input: OrderInput) => Promise<PurchaseOrder>;
  /** "sent" | "close" | "cancel" */
  act: (
    id: string,
    what: "sent" | "close" | "cancel",
  ) => Promise<PurchaseOrder>;
  /** Merge an order the server sent back (a bill entered against it) */
  put: (o: PurchaseOrder) => PurchaseOrder;
};

const at = (id: string) => `/api/purchase-orders/${encodeURIComponent(id)}`;

/**
 * Purchase orders. Loaded when Orders (or a bill from an order) is
 * opened; other counters' changes arrive through "purchase-orders".
 */
export const useOrderStore = create<Store>()((set) => {
  const put = (o: PurchaseOrder) => {
    set((s) => ({
      orders: s.orders.some((x) => x.id === o.id)
        ? s.orders.map((x) => (x.id === o.id ? o : x))
        : [o, ...s.orders],
    }));
    return o;
  };
  return {
    loaded: false,
    orders: [],
    load: async () => {
      const r = await apiGet<{ orders: PurchaseOrder[] }>(
        "/api/purchase-orders",
      );
      set({ orders: r.orders, loaded: true });
    },
    create: async (input) =>
      put(
        await apiRequest<PurchaseOrder>("POST", "/api/purchase-orders", input),
      ),
    update: async (id, input) =>
      put(await apiRequest<PurchaseOrder>("PUT", at(id), input)),
    act: async (id, what) =>
      put(await apiRequest<PurchaseOrder>("POST", `${at(id)}/${what}`)),
    put,
  };
});
