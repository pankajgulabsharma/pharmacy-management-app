import { create } from "zustand";
import { useInventoryStore } from "@/features/inventory/store/useInventoryStore";
import { useMedicineStore } from "@/features/medicines/store/useMedicineStore";
import { demoHeldBills, demoSaleReturns, demoSales } from "@/app/demo/seed";
import { newId } from "@/lib/id";
import { cleanText } from "@/lib/sanitize";
import {
  BILLING_LIMITS,
  type HeldBill,
  type Sale,
  type SaleInput,
  type SaleReturn,
  type SaleReturnInput,
} from "../types";
import { SaleError, buildSale, nextBillNo } from "../utils/sale";
import { buildSaleReturn, nextSaleReturnNo } from "../utils/saleReturn";

/**
 * Sales (bills), sales returns and held bills.
 * Stock is changed FIRST; the bill is stored only if that succeeded.
 * In memory for now — TODO(api).
 */
type SalesState = {
  sales: Sale[];
  saleReturns: SaleReturn[];
  held: HeldBill[];

  /** Validates, takes stock (FEFO) and saves the bill. Throws on any problem. */
  completeSale: (input: SaleInput) => Sale;
  /** Park the current cart. Stock is not reserved. */
  holdBill: (draft: Omit<HeldBill, "id" | "heldAt">) => HeldBill;
  /** Removes a held bill and returns it so the screen can load it */
  takeHeld: (id: string) => HeldBill;
  discardHeld: (id: string) => void;
  /** Puts goods back on the shelf and records the refund */
  createSaleReturn: (input: SaleReturnInput) => SaleReturn;
};

export const useSalesStore = create<SalesState>()((set, get) => ({
  sales: demoSales,
  saleReturns: demoSaleReturns,
  held: demoHeldBills,

  completeSale: (input) => {
    const { sales } = get();
    const medicines = new Map(
      useMedicineStore.getState().medicines.map((m) => [m.id, m]),
    );
    const inventory = useInventoryStore.getState();
    const now = new Date();

    const { sale, change } = buildSale(
      input,
      medicines,
      inventory.batches,
      nextBillNo(sales),
      now,
    );

    // 1) Stock out (throws and stops here if anything is short)
    inventory.change({
      refId: sale.id,
      type: "sale",
      note: `Sale ${sale.billNo} · ${sale.customerName}`,
      at: now,
      lines: change,
    });
    // 2) Then the bill
    set({ sales: [sale, ...sales] });
    return sale;
  },

  holdBill: (draft) => {
    const { held } = get();
    if (draft.lines.length === 0) throw new SaleError("Nothing to hold");
    if (held.length >= BILLING_LIMITS.maxHeld) {
      throw new SaleError(`You can hold up to ${BILLING_LIMITS.maxHeld} bills`);
    }
    const bill: HeldBill = {
      id: newId("held"),
      heldAt: new Date().toISOString(),
      customerName: cleanText(draft.customerName, BILLING_LIMITS.customerMax),
      doctor: cleanText(draft.doctor, 80),
      counter: cleanText(draft.counter, 30),
      lines: draft.lines
        .slice(0, BILLING_LIMITS.maxLines)
        .map((l) => ({ ...l })),
    };
    set({ held: [bill, ...held] });
    return bill;
  },

  takeHeld: (id) => {
    const bill = get().held.find((h) => h.id === id);
    if (!bill) throw new SaleError("Held bill not found");
    set((s) => ({ held: s.held.filter((h) => h.id !== id) }));
    return bill;
  },

  discardHeld: (id) => {
    set((s) => ({ held: s.held.filter((h) => h.id !== id) }));
  },

  createSaleReturn: (input) => {
    const { sales, saleReturns } = get();
    const sale = sales.find((s) => s.id === input.saleId);
    if (!sale) throw new SaleError("Bill not found");

    const now = new Date();
    const { ret, change } = buildSaleReturn(
      sale,
      input,
      saleReturns,
      nextSaleReturnNo(saleReturns),
      now,
    );

    // 1) Goods back on the shelf
    useInventoryStore.getState().change({
      refId: ret.id,
      type: "sale_return",
      note: `Sales return ${ret.returnNo} · ${sale.billNo}`,
      at: now,
      lines: change,
    });
    // 2) Then the return + refunded amount on the bill
    set({
      saleReturns: [ret, ...saleReturns],
      sales: sales.map((s) =>
        s.id === sale.id
          ? { ...s, returnedPaise: s.returnedPaise + ret.refundPaise }
          : s,
      ),
    });
    return ret;
  },
}));
