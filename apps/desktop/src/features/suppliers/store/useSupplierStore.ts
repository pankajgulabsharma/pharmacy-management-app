import { create } from "zustand";
import { newId } from "@medicare/domain/lib/id";
import { cleanCode, cleanText } from "@medicare/domain/lib/sanitize";
import { mockSuppliers } from "../data/mockSuppliers";
import { SUPPLIER_LIMITS, type Supplier, type SupplierInput } from "@medicare/domain/suppliers/types";
import { checkGstin } from "@medicare/domain/lib/gstin";
import { normalizePhone } from "@medicare/domain/suppliers/validation";

export class SupplierError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupplierError";
  }
}

/**
 * Supplier master. In memory for now. TODO(api): backend.
 * Deleting is guarded by the caller (a supplier with invoices can only be
 * made inactive) — see SuppliersPage.
 */
type SupplierState = {
  suppliers: Supplier[];
  addSupplier: (input: SupplierInput) => Supplier;
  updateSupplier: (id: string, input: SupplierInput) => void;
  removeSupplier: (id: string) => void;
};

/** Never trust callers: normalise, bound and re-check every field */
function sanitize(input: SupplierInput): SupplierInput {
  const gstin = input.gstin.trim().toUpperCase();
  if (!checkGstin(gstin).ok) throw new SupplierError("Invalid GSTIN");
  const days = Math.trunc(Number(input.creditDays));
  return {
    name: cleanText(input.name, SUPPLIER_LIMITS.nameMax),
    gstin,
    drugLicenseNo: cleanText(
      input.drugLicenseNo,
      SUPPLIER_LIMITS.drugLicenseMax,
    ).toUpperCase(),
    contactPerson: cleanText(input.contactPerson, SUPPLIER_LIMITS.contactMax),
    phone: normalizePhone(input.phone).slice(0, 11),
    email: cleanCode(input.email, SUPPLIER_LIMITS.emailMax).toLowerCase(),
    address: cleanText(input.address, SUPPLIER_LIMITS.addressMax),
    city: cleanText(input.city, SUPPLIER_LIMITS.cityMax),
    creditDays: Number.isFinite(days)
      ? Math.min(SUPPLIER_LIMITS.maxCreditDays, Math.max(0, days))
      : 0,
    status: input.status === "inactive" ? "inactive" : "active",
  };
}

function assertUnique(
  list: readonly Supplier[],
  s: SupplierInput,
  exceptId?: string,
) {
  for (const other of list) {
    if (other.id === exceptId) continue;
    if (other.gstin === s.gstin)
      throw new SupplierError("GSTIN already used by another supplier");
    if (other.name.toLowerCase() === s.name.toLowerCase()) {
      throw new SupplierError("A supplier with this name already exists");
    }
  }
}

export const useSupplierStore = create<SupplierState>()((set, get) => ({
  suppliers: mockSuppliers,

  addSupplier: (input) => {
    const clean = sanitize(input);
    if (!clean.name) throw new SupplierError("Name is required");
    assertUnique(get().suppliers, clean);
    const supplier: Supplier = {
      id: newId("sup"),
      ...clean,
      createdAt: new Date().toISOString(),
    };
    set((s) => ({ suppliers: [supplier, ...s.suppliers] }));
    return supplier;
  },

  updateSupplier: (id, input) => {
    const clean = sanitize(input);
    if (!clean.name) throw new SupplierError("Name is required");
    const list = get().suppliers;
    if (!list.some((s) => s.id === id))
      throw new SupplierError("Supplier not found");
    assertUnique(list, clean, id);
    set({ suppliers: list.map((s) => (s.id === id ? { ...s, ...clean } : s)) });
  },

  removeSupplier: (id) => {
    set((s) => ({ suppliers: s.suppliers.filter((x) => x.id !== id) }));
  },
}));
