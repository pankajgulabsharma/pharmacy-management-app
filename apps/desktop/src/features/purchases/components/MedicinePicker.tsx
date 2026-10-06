import {
  memo,
  useDeferredValue,
  useId,
  useMemo,
  useState,
  type KeyboardEvent,
} from "react";
import { Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { fieldClass } from "@/components/common/formStyles";
import {
  type MedicineWithStock,
  formatPackLabel,
} from "@/features/medicines/types";
import { medicineMatchesQuery } from "@/features/medicines/utils/search";

const MAX_RESULTS = 8;

type Props = {
  medicines: readonly MedicineWithStock[];
  onPick: (m: MedicineWithStock) => void;
  disabled?: boolean;
};

/**
 * Type-ahead search over the medicine master (active only).
 * ↑/↓ to move, Enter to add, Esc to clear. Barcode scanners work too,
 * since they type the code and press Enter.
 */
export const MedicinePicker = memo(function MedicinePicker({
  medicines,
  onPick,
  disabled,
}: Props) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const deferredQuery = useDeferredValue(query);

  const results = useMemo(() => {
    const q = deferredQuery.trim();
    if (!q) return [];
    const out: MedicineWithStock[] = [];
    for (const m of medicines) {
      if (m.status !== "active") continue;
      if (medicineMatchesQuery(m, q)) {
        out.push(m);
        if (out.length >= MAX_RESULTS) break;
      }
    }
    return out;
  }, [medicines, deferredQuery]);

  // Derived, so it never points past the end of a shorter result list
  const activeIndex = Math.min(active, Math.max(0, results.length - 1));
  const open = query.trim() !== "";

  const pick = (m: MedicineWithStock) => {
    onPick(m);
    setQuery("");
    setActive(0);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(Math.min(activeIndex + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(activeIndex - 1, 0));
    } else if (e.key === "Enter") {
      // Never submit the surrounding form from the search box
      e.preventDefault();
      const m = results[activeIndex];
      if (m) pick(m);
    } else if (e.key === "Escape" && query) {
      // Clear the search instead of closing the dialog
      e.stopPropagation();
      setQuery("");
      setActive(0);
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
        placeholder="Add medicine — search name, salt, brand or scan barcode…"
        className={cn(fieldClass, "pl-9")}
        aria-label="Add medicine to purchase"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && results[activeIndex] ? `${listId}-${activeIndex}` : undefined
        }
        autoComplete="off"
        spellCheck={false}
      />

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1 z-30 max-h-72 overflow-auto rounded-lg border border-border bg-popover text-popover-foreground shadow-lg py-1"
        >
          {results.length === 0 ? (
            <li className="px-3 py-2.5 text-[11px] text-muted-foreground">
              No active medicine matches “{query.trim()}”. Add it in Medicines
              first.
            </li>
          ) : (
            results.map((m, i) => (
              <li
                key={m.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === activeIndex}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(m)}
                className={cn(
                  "px-3 py-2 cursor-pointer flex items-center gap-3",
                  i === activeIndex ? "bg-muted" : "hover:bg-muted/60",
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
            ))
          )}
        </ul>
      )}
    </div>
  );
});
