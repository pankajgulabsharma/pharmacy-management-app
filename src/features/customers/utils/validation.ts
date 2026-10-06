import { parseRupees, type Paise } from "@/lib/money";
import { cleanText } from "@/lib/sanitize";
import {
  CUSTOMER_LIMITS as L,
  PAYMENT_IN_METHODS,
  type CustomerInput,
  type CustomerPaymentInput,
} from "../types";

export const digits = (v: string) => v.replace(/\D/g, "");

/** Indian mobile: 10 digits starting 6-9 (empty allowed) */
export function isValidPhone(phone: string): boolean {
  const d = digits(phone);
  return d === "" || /^[6-9]\d{9}$/.test(d);
}

export type CustomerForm = {
  name: string;
  phone: string;
  address: string;
  creditLimit: string;
  notes: string;
  status: CustomerInput["status"];
};

export function validateCustomerForm(
  f: CustomerForm,
  existingPhones: readonly string[],
): Partial<Record<keyof CustomerForm, string>> {
  const e: Partial<Record<keyof CustomerForm, string>> = {};
  if (cleanText(f.name, L.nameMax).length < 2) e.name = "Name is required";
  if (!isValidPhone(f.phone)) e.phone = "Enter a 10-digit mobile number";
  else if (digits(f.phone) && existingPhones.includes(digits(f.phone)))
    e.phone = "Another customer has this number";
  if (f.creditLimit.trim()) {
    const p = parseRupees(f.creditLimit);
    if (p === null || p < 0 || p > L.maxCreditLimitPaise)
      e.creditLimit = "Enter a valid amount (0 = no limit)";
  }
  return e;
}

/** Form → clean input (the store cleans again — never trust callers) */
export function toCustomerInput(f: CustomerForm): CustomerInput {
  return {
    name: cleanText(f.name, L.nameMax),
    phone: digits(f.phone).slice(0, 10),
    address: cleanText(f.address, L.addressMax),
    creditLimitPaise: Math.max(
      0,
      Math.min(L.maxCreditLimitPaise, parseRupees(f.creditLimit) ?? 0),
    ),
    notes: cleanText(f.notes, L.notesMax),
    status: f.status === "inactive" ? "inactive" : "active",
  };
}

/** Amount received: positive, max 2 decimals, never more than owed */
export function validatePaymentIn(
  p: CustomerPaymentInput,
  owedPaise: Paise,
): { ok: true; amountPaise: Paise } | { ok: false; error: string } {
  if (!(PAYMENT_IN_METHODS as readonly string[]).includes(p.method))
    return { ok: false, error: "Choose how the money came" };
  const amount = parseRupees(p.amount);
  if (amount === null || amount <= 0)
    return { ok: false, error: "Enter the amount received" };
  if (owedPaise <= 0) return { ok: false, error: "This customer owes nothing" };
  if (amount > owedPaise)
    return { ok: false, error: "More than the customer owes" };
  return { ok: true, amountPaise: amount };
}
