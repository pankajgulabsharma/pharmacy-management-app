/**
 * Normalise and check a supplier before it is saved — used by the app AND
 * the server, so both always store exactly the same thing.
 */
import { RuleError } from "../lib/errors";
import { checkGstin } from "../lib/gstin";
import { cleanCode, cleanText } from "../lib/sanitize";
import {
  SUPPLIER_LIMITS as L,
  type Supplier,
  type SupplierInput,
} from "./types";
import { normalizePhone } from "./validation";

export function cleanSupplierInput(input: SupplierInput): SupplierInput {
  const gstin = input.gstin.trim().toUpperCase();
  if (!checkGstin(gstin).ok) throw new RuleError("Invalid GSTIN");
  const name = cleanText(input.name, L.nameMax);
  if (!name) throw new RuleError("Name is required");
  const days = Math.trunc(Number(input.creditDays));
  return {
    name,
    gstin,
    drugLicenseNo: cleanText(
      input.drugLicenseNo,
      L.drugLicenseMax,
    ).toUpperCase(),
    contactPerson: cleanText(input.contactPerson, L.contactMax),
    phone: normalizePhone(input.phone).slice(0, 11),
    email: cleanCode(input.email, L.emailMax).toLowerCase(),
    address: cleanText(input.address, L.addressMax),
    city: cleanText(input.city, L.cityMax),
    creditDays: Number.isFinite(days)
      ? Math.min(L.maxCreditDays, Math.max(0, days))
      : 0,
    status: input.status === "inactive" ? "inactive" : "active",
  };
}

/** One supplier per GSTIN and per name (ignoring case) */
export function assertUniqueSupplier(
  others: readonly Pick<Supplier, "id" | "name" | "gstin">[],
  s: Pick<SupplierInput, "name" | "gstin">,
  exceptId?: string,
) {
  for (const o of others) {
    if (o.id === exceptId) continue;
    if (s.gstin && o.gstin === s.gstin)
      throw new RuleError("GSTIN already used by another supplier");
    if (o.name.toLowerCase() === s.name.toLowerCase())
      throw new RuleError("A supplier with this name already exists");
  }
}
