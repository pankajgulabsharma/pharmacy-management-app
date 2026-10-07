import {
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { SearchInput } from "@/components/common/SearchInput";
import { cn } from "@/lib/utils";
import { tr } from "@/lib/i18n";
import { useCan } from "@/features/auth/store/useAuthStore";
import { useMedicineStore } from "@/features/medicines/store/useMedicineStore";
import { useSalesStore } from "@/features/billing/store/useSalesStore";
import { useCustomerStore } from "@/features/customers/store/useCustomerStore";
import { useSupplierStore } from "@/features/suppliers/store/useSupplierStore";
import { usePurchaseStore } from "@/features/purchases/store/usePurchaseStore";
import { ReceiptDialog } from "@/features/billing/components/ReceiptDialog";
import { globalSearch, type SearchHit } from "@/features/search/globalSearch";

const IS_MAC =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.userAgent);
const SHORTCUT_LABEL = IS_MAC ? "⌘K" : "Ctrl K";

/**
 * Header search (Ctrl/⌘+K from anywhere): medicines, bills, customers,
 * suppliers, purchases. ↑↓ to pick, Enter to open, Esc to clear.
 * A bill opens right here (view / reprint); others open their screen
 * filtered to that item. Only shows what your role can open.
 */
export function GlobalSearch() {
  const navigate = useNavigate();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [billId, setBillId] = useState<string | null>(null);

  const canStock = useCan("stock");
  const medicines = useMedicineStore((s) => s.medicines);
  const sales = useSalesStore((s) => s.sales);
  const customers = useCustomerStore((s) => s.customers);
  const suppliers = useSupplierStore((s) => s.suppliers);
  const purchases = usePurchaseStore((s) => s.purchases);

  const deferred = useDeferredValue(query);
  const hits = useMemo(
    () =>
      globalSearch(deferred, {
        medicines,
        sales,
        customers,
        suppliers: canStock ? suppliers : undefined,
        purchases: canStock ? purchases : undefined,
      }),
    [deferred, medicines, sales, customers, suppliers, purchases, canStock],
  );
  const active = Math.min(index, Math.max(0, hits.length - 1));
  const bill = billId ? (sales.find((s) => s.id === billId) ?? null) : null;

  // ⌘K / Ctrl+K focuses the search from anywhere
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const choose = (h: SearchHit) => {
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
    if (h.saleId) setBillId(h.saleId);
    else if (h.to) navigate(h.to);
  };

  const showList = open && query.trim().length >= 2;

  return (
    <div className="relative flex-1 min-w-0 max-w-xl 2xl:max-w-2xl">
      <SearchInput
        value={query}
        onChange={(v) => {
          setQuery(v);
          setIndex(0);
          setOpen(true);
        }}
        placeholder="Search medicine, bill, customer, supplier, invoice…"
        ariaLabel="Search everything"
        size="lg"
        shortcut={SHORTCUT_LABEL}
        inputRef={inputRef}
        inputProps={{
          role: "combobox",
          "aria-expanded": showList,
          "aria-controls": listId,
          "aria-activedescendant": hits[active]
            ? `${listId}-${hits[active].key}`
            : undefined,
          onFocus: () => setOpen(true),
          onBlur: () => setOpen(false),
          onKeyDown: (e) => {
            if (!showList || hits.length === 0) return;
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              const d = e.key === "ArrowDown" ? 1 : -1;
              setIndex((active + d + hits.length) % hits.length);
            } else if (e.key === "Enter") {
              e.preventDefault();
              choose(hits[active]);
            }
          },
        }}
      />
      {showList ? (
        <div
          id={listId}
          role="listbox"
          // Keep focus in the box while clicking a result
          onMouseDown={(e) => e.preventDefault()}
          className="absolute left-0.5 right-0.5 top-full mt-1 z-50 max-h-[70vh] overflow-y-auto rounded-xl border border-border bg-popover text-popover-foreground shadow-xl p-1.5"
        >
          {hits.length === 0 ? (
            <p className="px-3 py-3 text-[12px] text-muted-foreground">
              {tr("Nothing found")}
            </p>
          ) : (
            hits.map((h, i) => (
              <div key={h.key}>
                {i === 0 || hits[i - 1].group !== h.group ? (
                  <p className="px-2.5 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {tr(h.group)}
                  </p>
                ) : null}
                <div
                  id={`${listId}-${h.key}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => choose(h)}
                  className={cn(
                    "cursor-pointer rounded-lg px-2.5 py-1.5",
                    i === active ? "bg-muted" : "hover:bg-muted/60",
                  )}
                >
                  <p className="text-[12.5px] font-medium truncate">
                    {h.title}
                  </p>
                  {h.detail ? (
                    <p className="text-[10.5px] text-muted-foreground truncate">
                      {h.detail}
                    </p>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}
      <ReceiptDialog
        sale={bill}
        autoPrint={false}
        reprint
        onClose={() => setBillId(null)}
      />
    </div>
  );
}
