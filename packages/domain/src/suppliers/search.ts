import { createSearch } from "../lib/search";
import type { Supplier } from "./types";

/** Suppliers by name, city, contact, mobile, GSTIN, licence or email */
export const supplierSearch = createSearch((s: Supplier) => ({
  name: s.name,
  text: [s.city, s.contactPerson, s.email],
  codes: [s.phone, s.gstin, s.drugLicenseNo],
}));
