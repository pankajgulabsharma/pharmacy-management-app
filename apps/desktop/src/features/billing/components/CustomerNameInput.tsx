import { useDeferredValue, useId, useMemo, useState, type Ref } from "react";
import { UserCheck } from "lucide-react";
import type { Customer } from "@medicare/domain/customers/types";
import { searchCustomers } from "@medicare/domain/customers/search";
import { useCustomerStore } from "@/features/customers/store/useCustomerStore";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { tr } from "@/lib/i18n";

/**
 * Customer name on the bill. Typing suggests saved customers (name or
 * mobile); picking one LINKS the bill to that customer — their mobile is
 * used for WhatsApp, their account for udhaar. Typing a different name
 * unlinks it (a walk-in stays a plain name).
 */
export function CustomerNameInput({
  value,
  customerId,
  onChange,
  onPick,
  inputRef,
  className,
}: {
  value: string;
  /** Linked customer account (null = just a typed name) */
  customerId: string | null;
  onChange: (name: string) => void;
  onPick: (c: Customer) => void;
  inputRef?: Ref<HTMLInputElement>;
  className?: string;
}) {
  const listId = useId();
  const customers = useCustomerStore((s) => s.customers);
  const linked = customerId
    ? (customers.find((c) => c.id === customerId) ?? null)
    : null;
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const q = useDeferredValue(value);
  const matches = useMemo(
    () =>
      q.trim().length >= 2 && !linked
        ? searchCustomers(
            customers.filter((c) => c.status === "active"),
            q,
            6,
          )
        : [],
    [customers, q, linked],
  );
  const open = focused && matches.length > 0;
  const index = Math.min(active, matches.length - 1);

  const pick = (c: Customer) => {
    onPick(c);
    setActive(0);
  };

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        value={value}
        placeholder={tr("Walk-in customer (F3)")}
        onChange={(e) => {
          onChange(e.target.value);
          setActive(0);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            const d = e.key === "ArrowDown" ? 1 : -1;
            setActive(Math.max(0, Math.min(matches.length - 1, index + d)));
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(matches[index]);
          } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            setFocused(false);
          }
        }}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${index}` : undefined}
        className={cn(className, linked && "pl-8")}
        autoComplete="off"
      />
      {linked ? (
        <UserCheck
          className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-emerald-600"
          aria-label={tr("Saved customer")}
        />
      ) : null}
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1 z-40 rounded-lg border border-border bg-popover text-popover-foreground shadow-lg py-1"
        >
          <li className="px-3 pt-1 pb-1.5 text-[10px] text-muted-foreground">
            {tr(
              "Saved customers — pick to link the bill (mobile for WhatsApp)",
            )}
          </li>
          {matches.map((c, i) => (
            <li
              key={c.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === index}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(c)}
              className={cn(
                "mx-1 px-2.5 py-1.5 rounded-md cursor-pointer flex items-center justify-between gap-3 text-[11px]",
                i === index ? "bg-primary/[0.08]" : "hover:bg-muted/60",
              )}
            >
              <span className="font-medium truncate">{c.name}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {c.phone || "—"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
