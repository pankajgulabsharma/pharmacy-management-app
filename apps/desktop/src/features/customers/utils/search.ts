import type { Customer } from "../types";

/**
 * Find customer accounts by name or mobile, BEST match first:
 *   0  name starts with the text        ("neha" → Neha Gupta)
 *   1  a word in the name starts with it ("gupta" → Neha Gupta)
 *   2  name merely contains it           ("neha" → Sneha Patel)
 *   mobile: 3+ digits anywhere in the number
 * Ranking matters: Enter picks the first one, and udhaar must never land
 * on the wrong person's account.
 */
export function searchCustomers(
  customers: readonly Customer[],
  query: string,
  limit = 5,
): Customer[] {
  const q = query.trim().toLowerCase();
  if (!q) return customers.slice(0, limit);
  const d = q.replace(/\D/g, "");
  const rank = (c: Customer): number => {
    const name = c.name.toLowerCase();
    if (name.startsWith(q)) return 0;
    if (name.split(/\s+/).some((w) => w.startsWith(q))) return 1;
    if (name.includes(q)) return 2;
    if (d.length >= 3 && c.phone.includes(d)) return d.length === 10 ? 0 : 1;
    return -1;
  };
  return customers
    .map((c) => ({ c, r: rank(c) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.c.name.localeCompare(b.c.name))
    .slice(0, limit)
    .map((x) => x.c);
}
