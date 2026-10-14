import { useMemo } from "react";
import { Search } from "lucide-react";
import type { LibraryItem } from "@medicare/domain/medicines/library";
import { useMedicinesWithStock } from "@/features/medicines/hooks/useMedicinesWithStock";
import { LibraryList } from "@/features/medicines/library/LibraryList";
import { tr } from "@/lib/i18n";

/** "Cefixime (200mg) + Ofloxacin (200mg)" → "cefixime" */
const mainSalt = (salt: string) => salt.split(/[+(]/)[0].trim().toLowerCase();

/**
 * Asked for a medicine the shop doesn't keep: what it is (Medicine
 * Library) and whether the SAME salt is in stock under another brand —
 * one click shows those, so the customer still gets served.
 */
export function LibraryAlternatives({
  items,
  onSearch,
}: {
  items: readonly LibraryItem[];
  onSearch: (q: string) => void;
}) {
  const medicines = useMedicinesWithStock();
  /** salt → how many of the shop's medicines with it are in stock */
  const inStock = useMemo(() => {
    const count = new Map<string, number>();
    for (const x of items) {
      const salt = mainSalt(x.salt);
      if (!salt || count.has(salt)) continue;
      count.set(
        salt,
        medicines.filter(
          (m) =>
            m.status === "active" &&
            m.sellableStrip + m.sellableLoose > 0 &&
            m.salt.toLowerCase().includes(salt),
        ).length,
      );
    }
    return count;
  }, [items, medicines]);
  const countOf = (x: LibraryItem) => inStock.get(mainSalt(x.salt)) ?? 0;

  return (
    <LibraryList
      items={items}
      title="Not in your shop — found in the Medicine Library"
      hint="Same salt in stock? Click it to see those medicines and sell one of them."
      canPick={(x) => countOf(x) > 0}
      onPick={(x) => onSearch(x.salt.split(/[+(]/)[0].trim())}
      action={(x) => {
        const n = countOf(x);
        return n > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
            <Search className="h-3 w-3" />
            {tr("{{n}} same salt in stock", { n })}
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground">
            {tr("Not in stock")}
          </span>
        );
      }}
      className="rounded-lg border border-border bg-card shrink-0 overflow-hidden"
    />
  );
}
