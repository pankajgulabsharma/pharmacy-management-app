import type { Medicine } from "../types";
import { CATEGORY_LABELS } from "../types";

function normalize(s: string) {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

/** tablets → tablet, syrups → syrup, capsules → capsule */
function stemToken(token: string) {
  let t = normalize(token);
  if (t.endsWith("ies") && t.length > 4) return t.slice(0, -3) + "y";
  if (t.endsWith("ses") && t.length > 4) return t.slice(0, -2);
  if (t.endsWith("s") && t.length > 3 && !t.endsWith("ss"))
    return t.slice(0, -1);
  return t;
}

function haystackFor(m: Medicine): string {
  return normalize(
    [
      m.name,
      m.salt,
      m.brand,
      m.hsn,
      m.barcode,
      m.rack,
      m.unit,
      m.category,
      m.category.replace(/_/g, " "),
      CATEGORY_LABELS[m.category],
    ].join(" "),
  );
}

/** Every query token must match (substring OR stemmed) */
export function medicineMatchesQuery(m: Medicine, query: string): boolean {
  const q = normalize(query);
  if (!q) return true;

  const hay = haystackFor(m);
  const tokens = q.split(" ").filter(Boolean);

  return tokens.every((token) => {
    const stem = stemToken(token);
    return hay.includes(token) || hay.includes(stem);
  });
}
