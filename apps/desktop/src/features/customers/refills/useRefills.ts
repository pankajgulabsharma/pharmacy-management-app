import { useCallback, useMemo, useSyncExternalStore } from "react";
import { refillsDue, type RefillDue } from "@medicare/domain/customers/refills";
import { useSalesStore } from "@/features/billing/store/useSalesStore";
import { useCustomerStore } from "../store/useCustomerStore";

/**
 * Reminders marked "done" on this computer: key → the bill they were for.
 * A new purchase of that medicine makes a new reminder (different bill).
 */
const STORAGE = "medicare-refills-done";
const listeners = new Set<() => void>();
let cache: Record<string, string> | null = null;

function readDone(): Record<string, string> {
  if (cache) return cache;
  try {
    const v = JSON.parse(window.localStorage.getItem(STORAGE) ?? "{}");
    cache = v && typeof v === "object" ? (v as Record<string, string>) : {};
  } catch {
    cache = {};
  }
  return cache;
}

function writeDone(next: Record<string, string>) {
  cache = next;
  try {
    window.localStorage.setItem(STORAGE, JSON.stringify(next));
  } catch {
    /* memory only */
  }
  for (const l of listeners) l();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Refills due now (overdue up to 15 days, coming up in 5), minus "done" */
export function useRefills() {
  const sales = useSalesStore((s) => s.sales);
  const customers = useCustomerStore((s) => s.customers);
  const done = useSyncExternalStore(subscribe, readDone, readDone);
  const all = useMemo(() => refillsDue(sales, customers), [sales, customers]);
  const due = useMemo(
    () => all.filter((r) => done[r.key] !== r.lastSaleId),
    [all, done],
  );
  const markDone = useCallback(
    (items: readonly RefillDue[]) => {
      const next = { ...readDone() };
      // Forget reminders that are no longer due (keeps storage small)
      const live = new Set(all.map((r) => r.key));
      for (const k of Object.keys(next)) if (!live.has(k)) delete next[k];
      for (const r of items) next[r.key] = r.lastSaleId;
      writeDone(next);
    },
    [all],
  );
  return { due, markDone };
}
