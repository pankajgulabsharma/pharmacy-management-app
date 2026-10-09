import { useMemo, useState } from "react";
import { UserPlus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { inrFromPaise } from "@medicare/domain/lib/money";
import { tr } from "@/lib/i18n";
import { useCustomerStore } from "@/features/customers/store/useCustomerStore";
import { useCustomerSummaries } from "@/features/customers/hooks/useCustomerSummaries";
import { CustomerFormDialog } from "@/features/customers/components/CustomerFormDialog";
import type { Customer } from "@medicare/domain/customers/types";
import { searchCustomers } from "@medicare/domain/customers/search";
import { caretToEndOnFocusClick } from "@/lib/dom";

type Props = {
  /** Selected account, or null */
  customerId: string | null;
  onChange: (c: Customer | null) => void;
  /** This bill's total — to show the balance after it */
  netPaise: number;
  /** What was typed in "Customer name" — used as the first search */
  initialQuery: string;
};

const MAX_MATCHES = 5;

/** Udhaar must go on an account: search by name / mobile, or create one */
export function CustomerAccountPicker({
  customerId,
  onChange,
  netPaise,
  initialQuery,
}: Props) {
  const customers = useCustomerStore((s) => s.customers);
  const sums = useCustomerSummaries();
  const [query, setQuery] = useState(initialQuery.trim());
  const [active, setActive] = useState(0);
  const [creating, setCreating] = useState(false);

  const selected = customers.find((c) => c.id === customerId) ?? null;
  const matches = useMemo(
    () =>
      searchCustomers(
        customers.filter((c) => c.status === "active"),
        query,
        MAX_MATCHES,
      ),
    [customers, query],
  );

  if (selected) {
    const owes = sums.get(selected.id)?.balancePaise ?? 0;
    const after = owes + netPaise;
    const over =
      selected.creditLimitPaise > 0 && after > selected.creditLimitPaise;
    return (
      <div
        className={cn(
          "rounded-md border p-2 space-y-1",
          over
            ? "border-red-500/40 bg-red-50/60 dark:bg-red-950/30"
            : "border-border bg-muted/30",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold truncate">
              {selected.name}
            </p>
            <p className="text-[9.5px] text-muted-foreground tabular-nums">
              {selected.phone || tr("No mobile")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            title={tr("Change customer")}
            aria-label={tr("Change customer")}
            className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:bg-muted"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">{tr("Owes now")}</span>
          <span className="tabular-nums">{inrFromPaise(owes)}</span>
        </div>
        <div className="flex justify-between text-[10px] font-semibold">
          <span>{tr("After this bill")}</span>
          <span
            className={cn(
              "tabular-nums",
              over ? "text-red-600" : "text-foreground",
            )}
          >
            {inrFromPaise(after)}
          </span>
        </div>
        {selected.creditLimitPaise > 0 ? (
          <p
            className={cn(
              "text-[9.5px]",
              over ? "text-red-600 font-medium" : "text-muted-foreground",
            )}
          >
            {tr("Limit")} {inrFromPaise(selected.creditLimitPaise)}
            {over ? ` — ${tr("Over limit")}` : ""}
          </p>
        ) : null}
      </div>
    );
  }

  const pick = (c: Customer) => onChange(c);

  return (
    <div className="space-y-1">
      <label className="block text-[9px] text-muted-foreground">
        {tr("Customer account")} *
      </label>
      <input
        autoFocus
        value={query}
        onMouseDown={caretToEndOnFocusClick}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, Math.max(0, matches.length - 1)));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(0, i - 1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (matches[active]) pick(matches[active]);
            else if (query.trim().length >= 2) setCreating(true);
          }
        }}
        placeholder={tr("Search customer by name or mobile")}
        aria-label={tr("Customer account")}
        className="h-7 w-full rounded-md border border-border/60 bg-background px-2 text-[10.5px] outline-none focus:ring-1 focus:ring-ring"
      />
      <ul
        role="listbox"
        aria-label={tr("Customer account")}
        className="rounded-md border border-border/60 overflow-hidden"
      >
        {matches.map((c, i) => (
          <li key={c.id}>
            <button
              type="button"
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(c)}
              className={cn(
                "w-full flex items-center justify-between gap-2 px-2 py-1 text-left text-[10px]",
                i === active ? "bg-primary/10" : "hover:bg-muted/50",
              )}
            >
              <span className="min-w-0 truncate">
                <span className="font-medium">{c.name}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {c.phone || "—"}
                </span>
              </span>
              <span
                className={cn(
                  "tabular-nums shrink-0",
                  (sums.get(c.id)?.balancePaise ?? 0) > 0
                    ? "text-red-600"
                    : "text-muted-foreground",
                )}
              >
                {inrFromPaise(sums.get(c.id)?.balancePaise ?? 0)}
              </span>
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="w-full flex items-center gap-1.5 px-2 py-1 text-left text-[10px] font-medium text-primary hover:bg-primary/5"
          >
            <UserPlus className="h-3 w-3" />
            {tr("Create account")}
            {query.trim() ? ` “${query.trim()}”` : ""}
          </button>
        </li>
      </ul>
      <CustomerFormDialog
        open={creating}
        customer={null}
        initialName={query.trim()}
        onClose={() => setCreating(false)}
        onSaved={pick}
      />
    </div>
  );
}
