import { useMemo } from "react";
import { Search } from "lucide-react";
import {
  parsePack,
  type LibraryItem,
} from "@medicare/domain/medicines/library";
import { substituteQuery } from "@medicare/domain/medicines/strength";
import { useSubstitutes } from "@/features/medicines/hooks/useSubstitutes";
import { LibraryList } from "@/features/medicines/library/LibraryList";
import { tr } from "@/lib/i18n";

/**
 * Asked for a medicine the shop doesn't keep: what it is (Medicine
 * Library) and whether a SUBSTITUTE is in stock — same salt, same
 * strength, same form under another brand. One click shows those, so
 * the customer still gets served.
 */
export function LibraryAlternatives({
  items,
  onSearch,
}: {
  items: readonly LibraryItem[];
  onSearch: (q: string) => void;
}) {
  const { countFor } = useSubstitutes();
  const counts = useMemo(
    () =>
      new Map(
        items.map((x) => [
          x.id,
          countFor({
            name: x.name,
            salt: x.salt,
            category: parsePack(x.pack).category,
          }),
        ]),
      ),
    [items, countFor],
  );
  const countOf = (x: LibraryItem) => counts.get(x.id) ?? 0;
  const anyInStock = items.some((x) => countOf(x) > 0);

  return (
    <LibraryList
      items={items}
      title="Not in your shop — found in the Medicine Library"
      hint={
        anyInStock
          ? "Green = a substitute is in stock (same salt, strength and form). Click it to see those medicines."
          : "No substitute in stock (same salt, strength and form) — order it from your supplier."
      }
      canPick={(x) => countOf(x) > 0}
      onPick={(x) => onSearch(substituteQuery(x.salt))}
      action={(x) => {
        const n = countOf(x);
        return n > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
            <Search className="h-3 w-3" />
            {tr("Show {{n}} in stock", { n })}
          </span>
        ) : (
          <span className="rounded-md bg-muted px-2 py-1 text-[10px] text-muted-foreground">
            {tr("Not in stock")}
          </span>
        );
      }}
      className="rounded-lg border border-border bg-card shrink-0 overflow-hidden"
    />
  );
}
