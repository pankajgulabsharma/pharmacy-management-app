import { create } from "zustand";
import { demoCustomerPayments, demoCustomers } from "@medicare/demo/seed";
import { useSalesStore } from "@/features/billing/store/useSalesStore";
import { newId } from "@medicare/domain/lib/id";
import { cleanText } from "@medicare/domain/lib/sanitize";
import {
  CUSTOMER_LIMITS as L,
  type Customer,
  type CustomerInput,
  type CustomerPayment,
  type CustomerPaymentInput,
} from "@medicare/domain/customers/types";
import { customerSummaries, nextReceiptNo } from "@medicare/domain/customers/ledger";
import { digits, isValidPhone, validatePaymentIn } from "@medicare/domain/customers/validation";

export class CustomerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomerError";
  }
}

type CustomerState = {
  customers: Customer[];
  payments: CustomerPayment[];
  addCustomer: (input: CustomerInput) => Customer;
  updateCustomer: (id: string, input: CustomerInput) => Customer;
  /** Money received against udhaar — never more than owed */
  recordPayment: (input: CustomerPaymentInput) => CustomerPayment;
};

/** Re-check everything at the store (screens validate too) */
function clean(
  input: CustomerInput,
  others: readonly Customer[],
): CustomerInput {
  const name = cleanText(input.name, L.nameMax);
  if (name.length < 2) throw new CustomerError("Name is required");
  if (!isValidPhone(input.phone))
    throw new CustomerError("Enter a 10-digit mobile number");
  const phone = digits(input.phone);
  if (phone && others.some((c) => c.phone === phone))
    throw new CustomerError("Another customer has this number");
  const limit = Number.isInteger(input.creditLimitPaise)
    ? input.creditLimitPaise
    : 0;
  return {
    name,
    phone,
    address: cleanText(input.address, L.addressMax),
    creditLimitPaise: Math.max(0, Math.min(L.maxCreditLimitPaise, limit)),
    notes: cleanText(input.notes, L.notesMax),
    status: input.status === "inactive" ? "inactive" : "active",
  };
}

/** What a customer owes right now (positive = owes us) */
export function owedBy(customerId: string): number {
  const { sales, saleReturns } = useSalesStore.getState();
  const { customers, payments } = useCustomerStore.getState();
  const c = customers.find((x) => x.id === customerId);
  if (!c) return 0;
  return (
    customerSummaries([c], sales, saleReturns, payments).get(c.id)
      ?.balancePaise ?? 0
  );
}

export const useCustomerStore = create<CustomerState>()((set, get) => ({
  customers: demoCustomers,
  payments: demoCustomerPayments,

  addCustomer: (input) => {
    const c: Customer = {
      id: newId("cus"),
      createdAt: new Date().toISOString(),
      ...clean(input, get().customers),
    };
    set({ customers: [c, ...get().customers] });
    return c;
  },

  updateCustomer: (id, input) => {
    const { customers } = get();
    const old = customers.find((c) => c.id === id);
    if (!old) throw new CustomerError("Customer not found");
    const next: Customer = {
      ...old,
      ...clean(
        input,
        customers.filter((c) => c.id !== id),
      ),
    };
    set({ customers: customers.map((c) => (c.id === id ? next : c)) });
    return next;
  },

  recordPayment: (input) => {
    const { customers, payments } = get();
    if (!customers.some((c) => c.id === input.customerId))
      throw new CustomerError("Customer not found");
    const v = validatePaymentIn(input, owedBy(input.customerId));
    if (!v.ok) throw new CustomerError(v.error);
    const p: CustomerPayment = {
      id: newId("pay"),
      receiptNo: nextReceiptNo(payments),
      customerId: input.customerId,
      at: new Date().toISOString(),
      amountPaise: v.amountPaise,
      method: input.method,
      reference: cleanText(input.reference, L.referenceMax),
      note: cleanText(input.note, L.notesMax),
    };
    set({ payments: [p, ...payments] });
    return p;
  },
}));
