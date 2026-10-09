import { createSearch } from "../lib/search";
import type { Customer } from "./types";

/**
 * Customer accounts by name or mobile, BEST match first ("neha" → Neha
 * Gupta before Rajesh Neharkar). Ranking matters: Enter picks the first
 * one, and udhaar must never land on the wrong person's account.
 */
export const customerSearch = createSearch((c: Customer) => ({
  name: c.name,
  codes: [c.phone],
}));

export function searchCustomers(
  customers: readonly Customer[],
  query: string,
  limit = 5,
): Customer[] {
  return customerSearch.filter(customers, query, { limit });
}
