import {
  SUPPLIER_LIMITS,
  type Supplier,
  type SupplierFormValues,
  type SupplierInput,
} from "./types";
import { checkGstin } from "../lib/gstin";

export type SupplierErrors = Partial<Record<keyof SupplierFormValues, string>>;

/** Indian mobile (10 digits, starts 6–9) or landline with STD code (0 + 9–10 digits) */
const PHONE_RE = /^(?:[6-9]\d{9}|0\d{9,10})$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const LICENSE_RE = /^[A-Z0-9][A-Z0-9\-/ ]*$/i;

/** Digits only — strips spaces, dashes and a leading +91 */
export function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.length === 12 && digits.startsWith("91")
    ? digits.slice(2)
    : digits;
}

export function validateSupplierForm(
  v: SupplierFormValues,
  existing: readonly Supplier[],
  editId: string | null,
): SupplierErrors {
  const e: SupplierErrors = {};
  const others = existing.filter((s) => s.id !== editId);

  const name = v.name.trim();
  if (!name) e.name = "Name is required";
  else if (name.length < 3) e.name = "Min 3 characters";
  else if (others.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
    e.name = "A supplier with this name already exists";
  }

  const gst = checkGstin(v.gstin);
  if (!v.gstin.trim()) e.gstin = "GSTIN is required";
  else if (!gst.ok) e.gstin = gst.reason;
  else if (others.some((s) => s.gstin === v.gstin.trim().toUpperCase())) {
    e.gstin = "This GSTIN is already used by another supplier";
  }

  if (v.drugLicenseNo.trim() && !LICENSE_RE.test(v.drugLicenseNo.trim())) {
    e.drugLicenseNo = "Only letters, digits, -, / and spaces";
  }

  const phone = normalizePhone(v.phone);
  if (!phone) e.phone = "Phone is required";
  else if (!PHONE_RE.test(phone))
    e.phone = "Enter a 10-digit mobile or STD landline";

  if (v.email.trim() && !EMAIL_RE.test(v.email.trim()))
    e.email = "Invalid email";

  if (!v.city.trim()) e.city = "City is required";

  const days = Number(v.creditDays);
  if (!/^\d{1,3}$/.test(v.creditDays) || days > SUPPLIER_LIMITS.maxCreditDays) {
    e.creditDays = `0–${SUPPLIER_LIMITS.maxCreditDays} days`;
  }

  return e;
}

export function formToSupplierInput(v: SupplierFormValues): SupplierInput {
  return {
    name: v.name,
    gstin: v.gstin,
    drugLicenseNo: v.drugLicenseNo,
    contactPerson: v.contactPerson,
    phone: normalizePhone(v.phone),
    email: v.email,
    address: v.address,
    city: v.city,
    creditDays: Number(v.creditDays) || 0,
    status: v.status,
  };
}
