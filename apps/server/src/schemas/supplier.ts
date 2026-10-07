/**
 * What a supplier sent to the server must look like: shape (Zod, no extra
 * fields) + the shop's rules (cleanSupplierInput, same as the app).
 */
import { z } from "zod";
import { cleanSupplierInput } from "@medicare/domain/suppliers/clean";
import {
  SUPPLIER_LIMITS as L,
  type SupplierInput,
} from "@medicare/domain/suppliers/types";
import { describe, InputError } from "./medicine";

export const supplierInputSchema = z
  .object({
    name: z.string().max(L.nameMax * 2),
    gstin: z.string().max(20),
    drugLicenseNo: z.string().max(L.drugLicenseMax * 2),
    contactPerson: z.string().max(L.contactMax * 2),
    phone: z.string().max(20),
    email: z.string().max(L.emailMax * 2),
    address: z.string().max(L.addressMax * 2),
    city: z.string().max(L.cityMax * 2),
    creditDays: z.number().int().min(0).max(L.maxCreditDays),
    status: z.enum(["active", "inactive"]),
  })
  .strict();

export function parseSupplier(body: unknown): SupplierInput {
  const r = supplierInputSchema.safeParse(body);
  if (!r.success) throw new InputError(describe(r.error));
  return cleanSupplierInput(r.data); // throws RuleError for a bad GSTIN / name
}
