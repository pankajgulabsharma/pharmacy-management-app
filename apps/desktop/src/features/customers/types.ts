import type { Paise } from "@/lib/money";

export type CustomerStatus = "active" | "inactive";

/** A customer account (khata) — needed for udhaar */
export type Customer = {
  id: string;
  name: string;
  /** 10-digit mobile, or "" */
  phone: string;
  address: string;
  /** Max udhaar allowed; 0 = no limit */
  creditLimitPaise: Paise;
  notes: string;
  status: CustomerStatus;
  createdAt: string;
};

export type CustomerInput = Omit<Customer, "id" | "createdAt">;

export const PAYMENT_IN_METHODS = ["cash", "upi", "card"] as const;
export type PaymentInMethod = (typeof PAYMENT_IN_METHODS)[number];
export const PAYMENT_IN_LABELS: Record<PaymentInMethod, string> = {
  cash: "Cash",
  upi: "UPI",
  card: "Card",
};

/** Money received against a customer's udhaar */
export type CustomerPayment = {
  id: string;
  /** "RC-0001" */
  receiptNo: string;
  customerId: string;
  /** ISO timestamp */
  at: string;
  amountPaise: Paise;
  method: PaymentInMethod;
  reference: string;
  note: string;
};

export type CustomerPaymentInput = {
  customerId: string;
  /** As typed, e.g. "500" or "499.50" */
  amount: string;
  method: PaymentInMethod;
  reference: string;
  note: string;
};

export const CUSTOMER_LIMITS = {
  nameMax: 60,
  addressMax: 160,
  notesMax: 200,
  referenceMax: 40,
  maxCreditLimitPaise: 10_00_000_00, // ₹10 lakh
} as const;
