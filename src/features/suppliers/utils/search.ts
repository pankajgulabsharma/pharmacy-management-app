import type { Supplier } from "../types";

function normalize(s: string) {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

const cache = new WeakMap<Supplier, string>();

/** Every token must match name, GSTIN, phone, city, contact or licence */
export function supplierMatchesQuery(s: Supplier, query: string): boolean {
  const q = normalize(query);
  if (!q) return true;
  let hay = cache.get(s);
  if (hay === undefined) {
    hay = normalize(
      [
        s.name,
        s.gstin,
        s.phone,
        s.city,
        s.contactPerson,
        s.drugLicenseNo,
        s.email,
      ].join(" "),
    );
    cache.set(s, hay);
  }
  return q.split(" ").every((t) => hay.includes(t));
}
