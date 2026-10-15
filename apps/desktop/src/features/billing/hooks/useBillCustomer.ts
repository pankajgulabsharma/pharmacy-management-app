import { useCallback, useMemo } from "react";
import type { Customer, CustomerInput } from "@medicare/domain/customers/types";
import { cleanCustomerInput } from "@medicare/domain/customers/clean";
import { useCustomerStore } from "@/features/customers/store/useCustomerStore";
import type { BillDraft } from "../store/useBillTabsStore";

export type BillCustomer = {
  /** Saved customer the bill is linked to (null = walk-in / typed name) */
  linked: Customer | null;
  /** Mobile shown on the bill: what was typed here, else the saved one */
  phone: string;
  /** Address shown on the bill: what was typed here, else the saved one */
  address: string;
  /** The typed mobile / address can't be saved to the customer (why) */
  error: string | null;
  /**
   * After the bill is saved: copies a changed mobile / address back to the
   * customer's account (Customers screen updates live). Returns an error
   * message when that fails — the bill itself is already saved.
   */
  saveBack: () => Promise<string | null>;
};

/**
 * One customer record everywhere: picking a saved customer fills the bill
 * from their account, and editing the mobile or address on the bill
 * updates that account too.
 *
 * The draft keeps only what was TYPED (undefined = "use the saved value"),
 * so a change made on the Customers screen meanwhile still shows here.
 */
export function useBillCustomer(draft: BillDraft): BillCustomer {
  const customers = useCustomerStore((s) => s.customers);
  const updateCustomer = useCustomerStore((s) => s.updateCustomer);

  const linked = useMemo(
    () =>
      draft.customerId
        ? (customers.find((c) => c.id === draft.customerId) ?? null)
        : null,
    [customers, draft.customerId],
  );
  const phone = draft.customerPhone ?? linked?.phone ?? "";
  const address = draft.patientAddress ?? linked?.address ?? "";

  // What would be saved to the account (null = nothing changed)
  const update = useMemo(():
    { input: CustomerInput } | { error: string } | null => {
    if (!linked) return null;
    const changed =
      phone.trim() !== linked.phone || address.trim() !== linked.address.trim();
    if (!changed) return null;
    try {
      const { id: _id, createdAt: _at, ...rest } = linked;
      return {
        input: cleanCustomerInput(
          { ...rest, phone, address },
          customers.filter((c) => c.id !== linked.id),
        ),
      };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [linked, phone, address, customers]);

  const saveBack = useCallback(async () => {
    if (!linked || !update || !("input" in update)) return null;
    try {
      await updateCustomer(linked.id, update.input);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "Could not update the customer";
    }
  }, [linked, update, updateCustomer]);

  return {
    linked,
    phone,
    address,
    error: update && "error" in update ? update.error : null,
    saveBack,
  };
}
