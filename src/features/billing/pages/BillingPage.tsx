import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { PauseCircle, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/EmptyState";
import { newId } from "@/lib/id";
import { inrFromPaise } from "@/lib/money";
import { StockError } from "@/features/inventory/utils/ledger";
import { BillingContextBar } from "../components/BillingContextBar";
import { MedicineSearchBar } from "../components/MedicineSearchBar";
import { SearchResultsTable } from "../components/SearchResultsTable";
import { BillItemsTable } from "../components/BillItemsTable";
import { BillSummaryPanel } from "../components/BillSummaryPanel";
import { BillingBottomStats } from "../components/BillingBottomStats";
import { SalesReturnPanel } from "../components/SalesReturnPanel";
import { ReceiptDialog } from "../components/ReceiptDialog";
import { HeldBillsDialog } from "../components/HeldBillsDialog";
import { useSettingsStore } from "@/features/settings/store/useSettingsStore";
import { useSalesStore } from "../store/useSalesStore";
import {
  useBillView,
  useSellableSearch,
  type SellableItem,
} from "../hooks/useBillingData";
import {
  EMPTY_PAYMENT,
  type CartLine,
  type PaymentDraft,
  type Sale,
} from "../types";
import { SaleError, nextBillNo, validatePayment } from "../utils/sale";

/** Show domain errors as-is; hide anything unexpected behind a generic message */
function errorMessage(err: unknown, fallback: string) {
  return err instanceof SaleError || err instanceof StockError
    ? err.message
    : fallback;
}

export default function BillingPage() {
  const sales = useSalesStore((s) => s.sales);
  const held = useSalesStore((s) => s.held);
  const completeSale = useSalesStore((s) => s.completeSale);
  const holdBill = useSalesStore((s) => s.holdBill);
  const takeHeld = useSalesStore((s) => s.takeHeld);
  const discardHeld = useSalesStore((s) => s.discardHeld);

  // Doctors, counters and defaults come from Settings
  const doctors = useSettingsStore((s) => s.doctors);
  const counters = useSettingsStore((s) => s.counters);
  const defaultCounter = useSettingsStore((s) => s.billing.defaultCounter);
  const defaultMethod = useSettingsStore((s) => s.billing.defaultPaymentMethod);
  const freshPayment = useMemo<PaymentDraft>(
    () => ({ ...EMPTY_PAYMENT, method: defaultMethod }),
    [defaultMethod],
  );

  const [mode, setMode] = useState<"billing" | "return">("billing");
  const [customerName, setCustomerName] = useState("");
  const [doctor, setDoctor] = useState<string>(() => doctors[0] ?? "");
  const [counter, setCounter] = useState<string>(defaultCounter);
  const [query, setQuery] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [payment, setPayment] = useState<PaymentDraft>(freshPayment);
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState<{
    sale: Sale;
    autoPrint: boolean;
  } | null>(null);
  const [heldOpen, setHeldOpen] = useState(false);
  /** Line to scroll to in the bill table (just added / increased) */
  const [focus, setFocus] = useState<{ lineId: string; key: number } | null>(
    null,
  );
  const savingRef = useRef(false);

  const deferredQuery = useDeferredValue(query);
  const results = useSellableSearch(deferredQuery);
  const bill = useBillView(cart);
  const billNo = useMemo(() => nextBillNo(sales), [sales]);

  /** Why the bill can't be saved yet (shown under the Save button) */
  const blockReason = useMemo(() => {
    if (cart.length === 0) return "Add at least one medicine";
    const lineError = bill.lines.find((l) => l.error)?.error;
    if (lineError) return lineError;
    return validatePayment(payment, bill.totals.netPaise, customerName);
  }, [cart.length, bill, payment, customerName]);

  /* ---------------- cart ---------------- */

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    setFocusedIndex(0);
  }, []);

  const handleClearSearch = useCallback(() => {
    setQuery("");
    setFocusedIndex(0);
  }, []);

  const addToCart = useCallback(
    (item: SellableItem) => {
      const { medicine: m, limits } = item;
      if (limits.maxStrip + limits.maxLoose === 0) {
        toast.error(`${m.name} is out of stock`);
        return;
      }
      // LSE medicines, or only loose stock left → start with 1 loose unit
      const loose = m.unit === "LSE" || limits.maxStrip === 0;
      const existing = cart.find((l) => l.medicineId === m.id);
      const lineId = existing?.lineId ?? newId("line");

      setCart((prev) =>
        existing
          ? // Same medicine again → one more (never beyond stock; the bill view re-checks)
            prev.map((l) =>
              l.lineId !== lineId
                ? l
                : loose
                  ? {
                      ...l,
                      qtyLoose: Math.min(l.qtyLoose + 1, limits.maxLoose),
                    }
                  : {
                      ...l,
                      qtyStrip: Math.min(l.qtyStrip + 1, limits.maxStrip),
                    },
            )
          : [
              ...prev,
              {
                lineId,
                medicineId: m.id,
                qtyStrip: loose ? 0 : 1,
                qtyLoose: loose ? 1 : 0,
                discountPercent: 0,
              },
            ],
      );
      // Scroll the bill to this line (new or existing) and highlight it
      setFocus((f) => ({ lineId, key: (f?.key ?? 0) + 1 }));
      setQuery("");
      setFocusedIndex(0);
    },
    [cart],
  );

  const changeQty = useCallback(
    (lineId: string, qtyStrip: number, qtyLoose: number) => {
      setCart((prev) =>
        prev.map((l) =>
          l.lineId === lineId ? { ...l, qtyStrip, qtyLoose } : l,
        ),
      );
    },
    [],
  );

  const changeDiscount = useCallback(
    (lineId: string, discountPercent: number) => {
      setCart((prev) =>
        prev.map((l) => (l.lineId === lineId ? { ...l, discountPercent } : l)),
      );
    },
    [],
  );

  const removeLine = useCallback((lineId: string) => {
    setCart((prev) => prev.filter((l) => l.lineId !== lineId));
  }, []);

  const resetBill = useCallback(() => {
    setCart([]);
    setPayment(freshPayment);
    setCustomerName("");
  }, [freshPayment]);

  /* ---------------- save / hold ---------------- */

  const handleSave = useCallback(
    (print: boolean) => {
      if (savingRef.current || blockReason) return; // double-submit guard
      savingRef.current = true;
      setSaving(true);
      try {
        const sale = completeSale({
          cart,
          customerName,
          doctor,
          counter,
          payment,
        });
        resetBill();
        if (print) {
          setReceipt({ sale, autoPrint: true });
        } else {
          toast.success(`Bill ${sale.billNo} saved`, {
            description: `${inrFromPaise(sale.totals.netPaise)} · stock updated`,
          });
        }
      } catch (err) {
        toast.error(errorMessage(err, "Could not save the bill"));
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
    [
      blockReason,
      completeSale,
      cart,
      customerName,
      doctor,
      counter,
      payment,
      resetBill,
    ],
  );

  const holdCurrent = useCallback((): boolean => {
    try {
      holdBill({ customerName, doctor, counter, lines: cart });
      resetBill();
      return true;
    } catch (err) {
      toast.error(errorMessage(err, "Could not hold the bill"));
      return false;
    }
  }, [holdBill, customerName, doctor, counter, cart, resetBill]);

  const handleHold = useCallback(() => {
    if (holdCurrent())
      toast.success("Bill held", { description: "Find it under “Held bills”" });
  }, [holdCurrent]);

  const handleResume = useCallback(
    (id: string) => {
      // Never lose the bill on screen: hold it first
      if (cart.length > 0 && !holdCurrent()) return;
      try {
        const h = takeHeld(id);
        setCart(h.lines);
        setCustomerName(h.customerName);
        setDoctor(h.doctor || (doctors[0] ?? ""));
        setCounter(h.counter || defaultCounter);
        setPayment(freshPayment);
        setHeldOpen(false);
        toast.info("Held bill resumed", {
          description: "Stock and prices were re-checked",
        });
      } catch (err) {
        toast.error(errorMessage(err, "Could not resume the bill"));
      }
    },
    [cart.length, holdCurrent, takeHeld, doctors, defaultCounter, freshPayment],
  );

  /* ---------------- keyboard ---------------- */

  useEffect(() => {
    if (mode !== "billing" || receipt || heldOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F9") {
        e.preventDefault();
        handleSave(true);
        return;
      }
      if (!query.trim() || results.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = results[focusedIndex];
        if (item) addToCart(item);
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleClearSearch();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    mode,
    receipt,
    heldOpen,
    query,
    results,
    focusedIndex,
    addToCart,
    handleClearSearch,
    handleSave,
  ]);

  // ——— Sales Return mode ———
  if (mode === "return") {
    return (
      <div className="h-full w-full p-3 overflow-hidden box-border bg-background">
        <SalesReturnPanel onClose={() => setMode("billing")} />
      </div>
    );
  }

  // ——— Billing mode ———
  const showSearchResults = query.trim().length > 0;

  return (
    <div className="h-full w-full p-3 overflow-hidden box-border bg-background">
      <div className="h-full grid grid-cols-12 gap-3 min-h-0">
        <div className="col-span-12 xl:col-span-9 flex flex-col gap-2.5 min-h-0 overflow-hidden">
          <BillingContextBar
            customerName={customerName}
            onCustomerChange={setCustomerName}
            onClearCustomer={() => setCustomerName("")}
            prescribedBy={doctor}
            onPrescribedByChange={setDoctor}
            counter={counter}
            onCounterChange={setCounter}
            doctors={doctors}
            counters={counters}
          />

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex-1 min-w-0">
              <MedicineSearchBar
                query={query}
                onQueryChange={handleQueryChange}
                onClear={handleClearSearch}
              />
            </div>

            {cart.length > 0 && (
              <button
                type="button"
                onClick={resetBill}
                className="h-9 shrink-0 rounded-lg border border-border px-3 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                Clear All
              </button>
            )}

            <button
              type="button"
              onClick={() => setHeldOpen(true)}
              className="h-9 shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 text-[11px] font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-500/15 transition-colors inline-flex items-center gap-1.5"
            >
              <PauseCircle className="h-3.5 w-3.5" />
              Held bills{held.length > 0 ? ` (${held.length})` : ""}
            </button>

            <button
              type="button"
              onClick={() => setMode("return")}
              className="h-9 shrink-0 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 text-[11px] font-medium text-orange-700 dark:text-orange-400 hover:bg-orange-500/15 transition-colors"
            >
              Sales Return
            </button>
          </div>

          {showSearchResults ? (
            <SearchResultsTable
              results={results}
              query={query}
              focusedIndex={focusedIndex}
              onSelect={addToCart}
              onHoverIndex={setFocusedIndex}
            />
          ) : cart.length > 0 ? (
            <BillItemsTable
              lines={bill.lines}
              focus={focus}
              onChangeQty={changeQty}
              onChangeDiscount={changeDiscount}
              onRemove={removeLine}
            />
          ) : (
            <EmptyState
              icon={ShoppingCart}
              title="No items in this bill yet"
              description="Search a medicine above or scan its barcode to add it."
            />
          )}

          <BillingBottomStats onViewAll={() => setMode("return")} />
        </div>

        <div className="col-span-12 xl:col-span-3 min-h-0 overflow-hidden">
          <BillSummaryPanel
            billNo={billNo}
            lines={bill.lines}
            totals={bill.totals}
            payment={payment}
            onPaymentChange={setPayment}
            customerName={customerName}
            blockReason={blockReason}
            saving={saving}
            onSave={handleSave}
            onHold={handleHold}
          />
        </div>
      </div>

      <HeldBillsDialog
        open={heldOpen}
        held={held}
        cartHasItems={cart.length > 0}
        onResume={handleResume}
        onDiscard={discardHeld}
        onClose={() => setHeldOpen(false)}
      />

      <ReceiptDialog
        sale={receipt?.sale ?? null}
        autoPrint={receipt?.autoPrint ?? false}
        onClose={() => setReceipt(null)}
      />
    </div>
  );
}
