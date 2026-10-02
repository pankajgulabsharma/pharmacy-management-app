import type { InventoryBatch } from "../types";
import { CATEGORY_LABELS } from "@/features/medicines/types";

function normalize(s: string) {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

function stemToken(token: string) {
  let t = normalize(token);
  if (t.endsWith("ies") && t.length > 4) return t.slice(0, -3) + "y";
  if (t.endsWith("ses") && t.length > 4) return t.slice(0, -2);
  if (t.endsWith("s") && t.length > 3 && !t.endsWith("ss"))
    return t.slice(0, -1);
  return t;
}

export function inventoryMatchesQuery(
  b: InventoryBatch,
  query: string,
): boolean {
  const q = normalize(query);
  if (!q) return true;

  const hay = normalize(
    [
      b.medicineName,
      b.salt,
      b.brand,
      b.batchNo,
      b.hsn,
      b.rack,
      b.expiry,
      b.unit,
      b.category,
      CATEGORY_LABELS[b.category],
    ].join(" "),
  );

  return q
    .split(" ")
    .filter(Boolean)
    .every((token) => {
      const stem = stemToken(token);
      return hay.includes(token) || hay.includes(stem);
    });
}
