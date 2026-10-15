import { useCallback, useMemo } from "react";
import type { MedicineCategory } from "@medicare/domain/medicines/types";
import { medicineComposition } from "@medicare/domain/medicines/strength";
import { useMedicinesWithStock } from "./useMedicinesWithStock";

type Composition = {
  name?: string;
  salt: string;
  strength?: string;
  category: MedicineCategory;
};

/**
 * Substitutes the shop can sell right now: active medicines with sellable
 * stock and the SAME salt + strength + form (see strength.ts). One index,
 * rebuilt only when medicines or stock change.
 *
 * `countFor(x, exceptId)` → how many substitutes are in stock for x.
 */
export function useSubstitutes() {
  const medicines = useMedicinesWithStock();
  const index = useMemo(() => {
    const byKey = new Map<string, string[]>();
    for (const m of medicines) {
      if (m.status !== "active" || m.sellableStrip + m.sellableLoose <= 0)
        continue;
      const key = medicineComposition(m);
      if (!key) continue;
      const ids = byKey.get(key);
      if (ids) ids.push(m.id);
      else byKey.set(key, [m.id]);
    }
    return byKey;
  }, [medicines]);

  const countFor = useCallback(
    (x: Composition, exceptId?: string) => {
      // Library items carry the strength inside the salt; shop medicines
      // may have it only in the name (saved before the Strength field)
      const key = medicineComposition({ ...x, name: x.name ?? "" });
      if (!key) return 0;
      const ids = index.get(key) ?? [];
      return exceptId ? ids.filter((id) => id !== exceptId).length : ids.length;
    },
    [index],
  );

  return { countFor };
}
