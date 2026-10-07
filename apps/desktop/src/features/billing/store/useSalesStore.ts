import { create } from "zustand";
import { demoHeldBills, demoSaleReturns, demoSales } from "@medicare/demo/seed";
import type {
  HeldBill,
  Sale,
  SaleInput,
  SaleReturn,
  SaleReturnInput,
} from "@medicare/domain/billing/types";
import type { ShopPatch } from "@medicare/domain/shop/patch";
import { apiGet, apiRequest, requireServer } from "@/lib/api";
import { applyShopPatch } from "@/stores/applyShopPatch";

/**
 * Bills, sales returns and held bills. The SERVER takes the stock (FEFO)
 * and saves the bill in one transaction; this store sends the cart and
 * merges what the server saved.
 */
type SalesState = {
  sales: Sale[];
  saleReturns: SaleReturn[];
  held: HeldBill[];
  source: "demo" | "server";
  loadFromServer: () => Promise<void>;
  completeSale: (input: SaleInput) => Promise<Sale>;
  /** Park the cart (stock is not reserved) */
  holdBill: (draft: Omit<HeldBill, "id" | "heldAt">) => Promise<HeldBill>;
  /** Take a held bill off the list — only one counter can */
  takeHeld: (id: string) => Promise<HeldBill>;
  discardHeld: (id: string) => Promise<void>;
  createSaleReturn: (input: SaleReturnInput) => Promise<SaleReturn>;
};

async function send<R extends { patch: ShopPatch }>(
  method: "POST" | "DELETE",
  path: string,
  body?: unknown,
): Promise<R> {
  requireServer(useSalesStore.getState().source);
  const r = await apiRequest<R>(method, path, body);
  applyShopPatch(r.patch);
  return r;
}

export const useSalesStore = create<SalesState>()((set) => ({
  sales: demoSales,
  saleReturns: demoSaleReturns,
  held: demoHeldBills,
  source: "demo",

  loadFromServer: async () => {
    const [s, h] = await Promise.all([
      apiGet<{ sales: Sale[]; saleReturns: SaleReturn[] }>("/api/sales"),
      apiGet<{ items: HeldBill[] }>("/api/held"),
    ]);
    set({
      sales: s.sales,
      saleReturns: s.saleReturns,
      held: h.items,
      source: "server",
    });
  },

  completeSale: async (input) =>
    (await send<{ sale: Sale; patch: ShopPatch }>("POST", "/api/sales", input))
      .sale,
  holdBill: async (draft) =>
    (
      await send<{ bill: HeldBill; patch: ShopPatch }>(
        "POST",
        "/api/held",
        draft,
      )
    ).bill,
  takeHeld: async (id) =>
    (
      await send<{ bill: HeldBill; patch: ShopPatch }>(
        "DELETE",
        `/api/held/${encodeURIComponent(id)}`,
      )
    ).bill,
  discardHeld: async (id) => {
    await send("DELETE", `/api/held/${encodeURIComponent(id)}`);
  },
  createSaleReturn: async (input) =>
    (
      await send<{ ret: SaleReturn; patch: ShopPatch }>(
        "POST",
        "/api/sale-returns",
        input,
      )
    ).ret,
}));
