import { create } from "zustand";
import { demoCustomerPayments, demoCustomers } from "@medicare/demo/seed";
import type {
  Customer,
  CustomerInput,
  CustomerPayment,
  CustomerPaymentInput,
} from "@medicare/domain/customers/types";
import type { ShopPatch } from "@medicare/domain/shop/patch";
import { apiGet, apiRequest, requireServer } from "@/lib/api";
import { applyShopPatch } from "@/stores/applyShopPatch";

/**
 * Customer accounts (khata) and payments received. The SERVER checks the
 * rules (one account per mobile, never more than owed) and saves.
 */
type CustomerState = {
  customers: Customer[];
  payments: CustomerPayment[];
  source: "demo" | "server";
  loadFromServer: () => Promise<void>;
  addCustomer: (input: CustomerInput) => Promise<Customer>;
  updateCustomer: (id: string, input: CustomerInput) => Promise<Customer>;
  /** Money received against udhaar — never more than owed */
  recordPayment: (input: CustomerPaymentInput) => Promise<CustomerPayment>;
};

async function send<R extends { patch: ShopPatch }>(
  method: "POST" | "PUT",
  path: string,
  body: unknown,
): Promise<R> {
  requireServer(useCustomerStore.getState().source);
  const r = await apiRequest<R>(method, path, body);
  applyShopPatch(r.patch);
  return r;
}

export const useCustomerStore = create<CustomerState>()((set) => ({
  customers: demoCustomers,
  payments: demoCustomerPayments,
  source: "demo",

  loadFromServer: async () => {
    const r = await apiGet<{
      customers: Customer[];
      payments: CustomerPayment[];
    }>("/api/customers");
    set({ customers: r.customers, payments: r.payments, source: "server" });
  },

  addCustomer: async (input) =>
    (
      await send<{ customer: Customer; patch: ShopPatch }>(
        "POST",
        "/api/customers",
        input,
      )
    ).customer,
  updateCustomer: async (id, input) =>
    (
      await send<{ customer: Customer; patch: ShopPatch }>(
        "PUT",
        `/api/customers/${encodeURIComponent(id)}`,
        input,
      )
    ).customer,
  recordPayment: async (input) =>
    (
      await send<{ payment: CustomerPayment; patch: ShopPatch }>(
        "POST",
        "/api/customer-payments",
        input,
      )
    ).payment,
}));
