import {
  memo,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { fieldClass } from "@/components/common/formStyles";
import {
  type MedicineWithStock,
  formatPackLabel,
} from "@medicare/domain/medicines/types";
import { medicineSearch } from "@medicare/domain/medicines/search";
import { caretToEndOnFocusClick, scrollRowIntoView } from "@/lib/dom";
import type { LibraryItem } from "@medicare/domain/medicines/library";
import { useLibrarySearch } from "@/features/medicines/library/useLibrarySearch";
import { LibraryList } from "@/features/medicines/library/LibraryList";
import { tr } from "@/lib/i18n";

const MAX_RESULTS = 8;
const MAX_LIBRARY = 6;

type Props = {
  medicines: readonly MedicineWithStock[];
  onPick: (m: MedicineWithStock) => void;
  /** Not in the shop's medicines → add it from the Medicine Library */
  onPickLibrary?: (item: LibraryItem) => void;
  disabled?: boolean;
};

/**
 * Type-ahead search over the medicine master (active only), then — for a
 * medicine the shop has never stocked — the Medicine Library below it.
 * ↑/↓ move through both lists, Enter adds, Esc clears. Barcode scanners
 * work too, since they type the code and press Enter.
 */
export const MedicinePicker = memo(function MedicinePicker({
  medicines,
  onPick,
  onPickLibrary,
  disabled,
}: Props) {
  const listId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const deferredQuery = useDeferredValue(query);

  const results = useMemo(() => {
    if (!deferredQuery.trim()) return [];
    return medicineSearch.filter(medicines, deferredQuery, {
      keep: (m) => m.status === "active",
      limit: MAX_RESULTS,
    });
  }, [medicines, deferredQuery]);

  // Library (3+ letters), minus what the shop already has
  const found = useLibrarySearch(
    deferredQuery.trim().length >= 3 ? deferredQuery : "",
    !!onPickLibrary,
    MAX_LIBRARY + 4,
  ).items;
  const library = useMemo(() => {
    if (found.length === 0) return found;
    const have = new Set(medicines.map((m) => m.name.toLowerCase()));
    return found
      .filter((x) => !have.has(x.name.toLowerCase()))
      .slice(0, MAX_LIBRARY);
  }, [found, medicines]);

  const count = results.length + library.length;
  // Derived, so it never points past the end of a shorter result list
  const activeIndex = Math.min(active, Math.max(0, count - 1));
  const open = query.trim() !== "";

  // ↑ ↓ keep the highlighted row on screen (own list; the library list
  // scrolls its own rows)
  useEffect(() => {
    if (activeIndex < results.length)
      scrollRowIntoView(
        boxRef.current?.querySelector<HTMLElement>(
          `[data-row="${activeIndex}"]`,
        ) ?? null,
      );
  }, [activeIndex, results.length]);

  const reset = () => {
    setQuery("");
    setActive(0);
  };
  const pickAt = (i: number) => {
    if (i < results.length) onPick(results[i]);
    else if (library[i - results.length])
      onPickLibrary?.(library[i - results.length]);
    else return;
    reset();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(Math.min(activeIndex + 1, count - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(activeIndex - 1, 0));
    } else if (e.key === "Enter") {
      // Never submit the surrounding form from the search box
      e.preventDefault();
      pickAt(activeIndex);
    } else if (e.key === "Escape" && query) {
      // Clear the search instead of closing the dialog
      e.stopPropagation();
      reset();
    }
  };

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
      <input
        type="search"
        value={query}
        disabled={disabled}
        onChange={(e) => {
          setQuery(e.target.value.slice(0, 80));
          setActive(0);
        }}
        onKeyDown={onKeyDown}
        onMouseDown={caretToEndOnFocusClick}
        placeholder="Add medicine — search name, salt, brand or scan barcode…"
        className={cn(fieldClass, "pl-9")}
        aria-label="Add medicine to purchase"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && count > 0 ? `${listId}-${activeIndex}` : undefined
        }
        autoComplete="off"
        spellCheck={false}
      />

      {open && (
        <div
          ref={boxRef}
          className="absolute left-0 right-0 top-full mt-1 z-30 max-h-80 overflow-auto rounded-lg border border-border bg-popover text-popover-foreground shadow-lg"
        >
          {results.length > 0 ? (
            <ul id={listId} role="listbox" className="py-1">
              {results.map((m, i) => (
                <li
                  key={m.id}
                  id={`${listId}-${i}`}
                  data-row={i}
                  role="option"
                  aria-selected={i === activeIndex}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pickAt(i)}
                  className={cn(
                    "mx-1 px-2.5 py-2 rounded-md cursor-pointer flex items-center gap-3 border-l-2",
                    i === activeIndex
                      ? "bg-primary/[0.07] border-primary"
                      : "border-transparent hover:bg-muted/60",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium text-foreground truncate">
                      {m.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {m.salt || "—"} · {m.brand} ·{" "}
                      {formatPackLabel(m.unit, m.unitsPerStrip)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[11px] tabular-nums text-foreground">
                      MRP ₹{m.mrp.toFixed(2)}
                    </p>
                    <p className="text-[10px] tabular-nums text-muted-foreground">
                      Stock {m.stockStrip} {m.unit}
                    </p>
                  </div>
                  <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </li>
              ))}
            </ul>
          ) : library.length === 0 ? (
            <p className="px-3 py-2.5 text-[11px] text-muted-foreground">
              {tr("No medicine matches “{{q}}”.", { q: query.trim() })}{" "}
              {onPickLibrary && query.trim().length < 3
                ? tr("Type 3+ letters to search the Medicine Library.")
                : tr("Add it in Medicines first.")}
            </p>
          ) : null}
          <LibraryList
            items={library}
            onPick={(x) => pickAt(results.length + library.indexOf(x))}
            activeIndex={activeIndex - results.length}
            onHover={(i) => setActive(results.length + i)}
            idPrefix={listId}
            indexOffset={results.length}
            hint={
              results.length > 0
                ? "New to your shop? Pick it — the medicine form opens filled in."
                : "Pick one — the medicine form opens filled in; check and save, it goes on this bill."
            }
            className={cn(results.length > 0 && "border-t border-border")}
          />
        </div>
      )}
    </div>
  );
});
