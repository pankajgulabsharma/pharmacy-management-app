import { create } from "zustand";
import { useInventoryStore } from "@/features/inventory/store/useInventoryStore";
import { useMedicineStore } from "@/features/medicines/store/useMedicineStore";
import {
  owedBy,
  useCustomerStore,
} from "@/features/customers/store/useCustomerStore";
import { demoHeldBills, demoSaleReturns, demoSales } from "@medicare/demo/seed";
import { newId } from "@medicare/domain/lib/id";
import { cleanText } from "@medicare/domain/lib/sanitize";
import {
  BILLING_LIMITS,
  type HeldBill,
  type Sale,
  type SaleInput,
  type SaleReturn,
  type SaleReturnInput,
} from "@medicare/domain/billing/types";
import { SaleError, buildSale, nextBillNo } from "@medicare/domain/billing/sale";
import { buildSaleReturn, nextSaleReturnNo } from "@medicare/domain/billing/saleReturn";

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

    // Udhaar goes on an active customer account, within its credit limit
    let customerName = input.customerName;
    if (input.payment.method === "udhaar") {
      const c = useCustomerStore
        .getState()
        .customers.find((x) => x.id === input.customerId);
      if (!c) throw new SaleError("Choose the customer's account for udhaar");
      if (c.status !== "active")
        throw new SaleError(`${c.name}'s account is inactive`);
      customerName = c.name;
    }

    const { sale, change } = buildSale(
      { ...input, customerName },
      medicines,
      inventory.batches,
      nextBillNo(sales),
      now,
    );

    if (sale.status === "udhaar" && sale.customerId) {
      const c = useCustomerStore
        .getState()
        .customers.find((x) => x.id === sale.customerId)!;
      const after = owedBy(c.id) + sale.totals.netPaise;
      if (c.creditLimitPaise > 0 && after > c.creditLimitPaise) {
        throw new SaleError(
          `Over ${c.name}'s udhaar limit of ₹${(c.creditLimitPaise / 100).toLocaleString("en-IN")}`,
        );
      }
    }

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
