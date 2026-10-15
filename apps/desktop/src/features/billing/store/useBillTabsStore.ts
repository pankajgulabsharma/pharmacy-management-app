import { useCallback, type SetStateAction } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { newId } from "@medicare/domain/lib/id";
import type { CartLine, PaymentDraft } from "@medicare/domain/billing/types";

/**
 * Bills open at the counter — up to 10 at once, one tab each, so the
 * cashier can serve the next customer while the first one looks for cash.
 *
 * Drafts are kept on THIS computer (not the server) and survive a restart
 * or a crash. Saving a bill closes its tab; "Hold" still parks a bill on
 * the server for any counter to resume.
 */
export const MAX_BILL_TABS = 10;

export type BillDraft = {
  id: string;
  cart: CartLine[];
  customerName: string;
  /** Saved customer picked for this bill (null = typed name only) */
  customerId: string | null;
  /**
   * Patient's address (asked when a register drug — H1 / X / NDPS — is on
   * the bill). For a saved customer, undefined = their saved address.
   */
  patientAddress?: string;
  /** Mobile typed for a saved customer (undefined = their saved mobile) */
  customerPhone?: string;
  /** B2B bill: buyer's GSTIN (null = retail bill) */
  customerGstin: string | null;
  /** null = the shop's default (first doctor / default counter) */
  doctor: string | null;
  counter: string | null;
  /** null = a fresh payment with the default method */
  payment: PaymentDraft | null;
  udhaarCustomerId: string | null;
  /** Last total shown for this bill (for the tab label) */
  netPaise: number;
};

type Patch = Partial<Omit<BillDraft, "id">>;

type BillTabsState = {
  drafts: BillDraft[];
  activeId: string;
  /** Opens a new bill (false when 10 are already open) */
  open: (init?: Patch) => boolean;
  select: (id: string) => void;
  /** Closes a tab; the last one is emptied instead */
  close: (id: string) => void;
  update: (id: string, patch: Patch | ((d: BillDraft) => Patch)) => void;
};

export const blankDraft = (init: Patch = {}): BillDraft => ({
  id: newId("bill"),
  cart: [],
  customerName: "",
  customerId: null,
  customerGstin: null,
  doctor: null,
  counter: null,
  payment: null,
  udhaarCustomerId: null,
  netPaise: 0,
  ...init,
});

export const isEmptyDraft = (d: BillDraft) =>
  d.cart.length === 0 && !d.customerName.trim();

const str = (v: unknown, max = 200) =>
  typeof v === "string" ? v.slice(0, max) : "";
const optStr = (v: unknown, max = 200) =>
  typeof v === "string" ? v.slice(0, max) : undefined;
const strOrNull = (v: unknown) =>
  typeof v === "string" ? v.slice(0, 200) : null;

/** Whatever was on disk → safe drafts (never trust old or edited storage) */
function cleanDrafts(v: unknown): BillDraft[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((d): d is Record<string, unknown> => !!d && typeof d === "object")
    .slice(0, MAX_BILL_TABS)
    .map((d) => ({
      id: str(d.id, 60) || newId("bill"),
      cart: Array.isArray(d.cart)
        ? (d.cart as CartLine[]).filter(
            (l) =>
              l &&
              typeof l.lineId === "string" &&
              typeof l.medicineId === "string" &&
              Number.isFinite(l.qtyStrip) &&
              Number.isFinite(l.qtyLoose),
          )
        : [],
      customerName: str(d.customerName),
      customerId: strOrNull(d.customerId),
      patientAddress: optStr(d.patientAddress),
      customerPhone: optStr(d.customerPhone, 15),
      customerGstin: strOrNull(d.customerGstin),
      doctor: strOrNull(d.doctor),
      counter: strOrNull(d.counter),
      payment:
        d.payment && typeof d.payment === "object"
          ? (d.payment as PaymentDraft)
          : null,
      udhaarCustomerId: strOrNull(d.udhaarCustomerId),
      netPaise: Number.isFinite(d.netPaise) ? (d.netPaise as number) : 0,
    }));
}

/** localStorage can be full, blocked or missing — drafts then live in memory */
const safeStorage = {
  getItem: (k: string) => {
    try {
      return window.localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k: string, v: string) => {
    try {
      window.localStorage.setItem(k, v);
    } catch {
      /* memory only */
    }
  },
  removeItem: (k: string) => {
    try {
      window.localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};

const first = blankDraft();

export const useBillTabsStore = create<BillTabsState>()(
  persist(
    (set, get) => ({
      drafts: [first],
      activeId: first.id,
      open: (init) => {
        if (get().drafts.length >= MAX_BILL_TABS) return false;
        const d = blankDraft(init);
        set((s) => ({ drafts: [...s.drafts, d], activeId: d.id }));
        return true;
      },
      select: (id) => {
        if (get().drafts.some((d) => d.id === id)) set({ activeId: id });
      },
      close: (id) =>
        set((s) => {
          const i = s.drafts.findIndex((d) => d.id === id);
          if (i < 0) return s;
          if (s.drafts.length === 1) {
            const d = blankDraft();
            return { drafts: [d], activeId: d.id };
          }
          const drafts = s.drafts.filter((d) => d.id !== id);
          const activeId =
            s.activeId === id
              ? drafts[Math.min(i, drafts.length - 1)].id
              : s.activeId;
          return { drafts, activeId };
        }),
      update: (id, patch) =>
        set((s) => ({
          drafts: s.drafts.map((d) =>
            d.id === id
              ? { ...d, ...(typeof patch === "function" ? patch(d) : patch) }
              : d,
          ),
        })),
    }),
    {
      name: "medicare-bill-tabs",
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ drafts: s.drafts, activeId: s.activeId }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<BillTabsState>;
        const drafts = cleanDrafts(p.drafts);
        if (drafts.length === 0) return current;
        const activeId = drafts.some((d) => d.id === p.activeId)
          ? (p.activeId as string)
          : drafts[0].id;
        return { ...current, drafts, activeId };
      },
    },
  ),
);

/** setState-style setter for one field of a bill draft */
export function useDraftField<K extends keyof Omit<BillDraft, "id">>(
  id: string,
  key: K,
) {
  const update = useBillTabsStore((s) => s.update);
  return useCallback(
    (v: SetStateAction<BillDraft[K]>) =>
      update(
        id,
        (d) =>
          ({
            [key]:
              typeof v === "function"
                ? (v as (prev: BillDraft[K]) => BillDraft[K])(d[key])
                : v,
          }) as Patch,
      ),
    [update, id, key],
  );
}
