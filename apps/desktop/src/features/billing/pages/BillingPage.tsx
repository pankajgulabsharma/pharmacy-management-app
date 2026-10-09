import { scheduleRule } from "@medicare/domain/medicines/schedule";
import { ApiError } from "@/lib/api";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { PauseCircle, ShoppingCart } from "lucide-react";
import { Kbd } from "@/components/common/Kbd";
import { useHotkeys } from "@/hooks/useHotkeys";
import { useUrlIntent } from "@/hooks/useUrlIntent";
import { usePageActive } from "@/hooks/usePageActive";
import { isTyping } from "@/lib/hotkeys";
import { KEYS } from "@/app/shortcuts/registry";
import { BatchHistoryDialog } from "@/features/inventory/components/BatchHistoryDialog";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/EmptyState";
import { newId } from "@medicare/domain/lib/id";
import { inrFromPaise } from "@medicare/domain/lib/money";
import { StockError } from "@medicare/domain/inventory/ledger";
import { BillingContextBar } from "../components/BillingContextBar";
import { MedicineSearchBar } from "../components/MedicineSearchBar";
import { SearchResultsTable } from "../components/SearchResultsTable";
import { BillItemsTable } from "../components/BillItemsTable";
import { BillSummaryPanel } from "../components/BillSummaryPanel";
import { TodayBar } from "../components/TodayBar";
import { CustomerAccountPicker } from "../components/CustomerAccountPicker";
import { SalesReturnPanel } from "../components/SalesReturnPanel";
import { ReceiptDialog } from "../components/ReceiptDialog";
import { HeldBillsDialog } from "../components/HeldBillsDialog";
import { useSettingsStore } from "@/features/settings/store/useSettingsStore";
import { useSalesStore } from "../store/useSalesStore";
import {
  useBillView,
  useBarcodeLookup,
  useSellableSearch,
  type SellableItem,
} from "../hooks/useBillingData";
import {
  DISCOUNT_OPTIONS,
  EMPTY_PAYMENT,
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
  type CartLine,
  type PaymentDraft,
  type Sale,
} from "@medicare/domain/billing/types";
import {
  SaleError,
  b2bParty,
  nextBillNo,
  validatePayment,
} from "@medicare/domain/billing/sale";
import { tr } from "@/lib/i18n";

/**
 * Shop rules and the server's answers (e.g. "short stock", "licence on
 * hold") are shown as-is; offline / unexpected errors get a plain message.
 */
function errorMessage(err: unknown, fallback: string) {
  if (err instanceof SaleError || err instanceof StockError) return err.message;
  if (err instanceof ApiError)
    return err.kind === "http" ? err.message : `${fallback} — ${err.message}`;
  return fallback;
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
  /** Customer account for udhaar (required when paying by udhaar) */
  const [udhaarCustomerId, setUdhaarCustomerId] = useState<string | null>(null);
  /** Bill picked from "Recent bills" → opens Sales Return on it */
  const [returnSaleId, setReturnSaleId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  /** B2B (GST) bill: buyer's GSTIN — "" for a normal retail bill */
  const [customerGstin, setCustomerGstin] = useState<string | null>(null);
  const shopGstin = useSettingsStore((s) => s.shop.gstin);
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
  const searchRef = useRef<HTMLInputElement>(null);
  const customerRef = useRef<HTMLInputElement>(null);
  /** Amount box of the current payment method (cash received / split / ref) */
  const amountRef = useRef<HTMLInputElement | null>(null);
  const setAmountRef = useCallback((el: HTMLInputElement | null) => {
    amountRef.current = el;
  }, []);
  /** Bill line picked with ↑ ↓ (when the search box is empty) */
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [historyBatchId, setHistoryBatchId] = useState<string | null>(null);

  // F2 from any screen opens /billing?focus=search
  // Opening Billing (sidebar, Alt+2, F2, Dashboard…) puts the cursor straight
  // in the medicine search — the cashier can start typing immediately.
  useUrlIntent(); // clears ?focus=search from the URL
  // Coming back to this tab (it stays alive in the background) also counts
  const pageActive = usePageActive();
  useEffect(() => {
    if (pageActive && mode === "billing") searchRef.current?.focus();
  }, [mode, pageActive]);

  /** Ready for the next customer: cursor back in the medicine search */
  const focusSearch = useCallback(() => {
    requestAnimationFrame(() => searchRef.current?.focus());
  }, []);

  const deferredQuery = useDeferredValue(query);
  const results = useSellableSearch(deferredQuery);
  const byBarcode = useBarcodeLookup();
  const bill = useBillView(cart);
  const billPrefix = useSettingsStore((s) => s.billing.billPrefix);
  const billNo = useMemo(
    () => nextBillNo(sales, billPrefix),
    [sales, billPrefix],
  );

  /** Why the bill can't be saved yet (shown under the Save button) */
  const blockReason = useMemo(() => {
    if (cart.length === 0) return "Add at least one medicine";
    const lineError = bill.lines.find((l) => l.error)?.error;
    if (lineError) return lineError;
    // Schedule H / H1 / X: doctor (and patient name) before saving
    const rx = scheduleRule(
      bill.lines.flatMap((l) =>
        l.medicine
          ? [{ medicineName: l.medicine.name, schedule: l.medicine.schedule }]
          : [],
      ),
      customerName,
      doctor,
    );
    if (rx) return rx;
    if (customerGstin)
      try {
        b2bParty(customerGstin, shopGstin, customerName);
      } catch (e) {
        return (e as Error).message;
      }
    return validatePayment(
      payment,
      bill.totals.netPaise,
      customerName,
      udhaarCustomerId,
    );
  }, [
    cart.length,
    bill,
    payment,
    customerName,
    doctor,
    udhaarCustomerId,
    customerGstin,
    shopGstin,
  ]);

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
      // Ready to change its quantity right away with + / −
      setSelectedLineId(lineId);
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
    setUdhaarCustomerId(null);
    setCart([]);
    setPayment(freshPayment);
    setCustomerName("");
    setCustomerGstin(null);
  }, [freshPayment]);

  /* ---------------- save / hold ---------------- */

  const handleSave = useCallback(
    async (print: boolean) => {
      if (savingRef.current || blockReason) return; // double-submit guard
      savingRef.current = true;
      setSaving(true);
      try {
        // The server checks stock, takes it (FEFO) and saves — all or nothing
        const sale = await completeSale({
          cart,
          customerName,
          customerId: payment.method === "udhaar" ? udhaarCustomerId : null,
          doctor,
          counter,
          payment,
          ...(customerGstin ? { customerGstin } : {}),
        });
        resetBill();
        setSelectedLineId(null);
        focusSearch();
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
      focusSearch,
      udhaarCustomerId,
      customerGstin,
    ],
  );

  const holdCurrent = useCallback(async (): Promise<boolean> => {
    try {
      await holdBill({ customerName, doctor, counter, lines: cart });
      resetBill();
      return true;
    } catch (err) {
      toast.error(errorMessage(err, "Could not hold the bill"));
      return false;
    }
  }, [holdBill, customerName, doctor, counter, cart, resetBill]);

  const handleHold = useCallback(async () => {
    if (await holdCurrent())
      toast.success("Bill held", { description: "Find it under “Held bills”" });
  }, [holdCurrent]);

  const handleResume = useCallback(
    async (id: string) => {
      // Never lose the bill on screen: hold it first
      if (cart.length > 0 && !(await holdCurrent())) return;
      try {
        const h = await takeHeld(id);
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

  const searching = query.trim().length > 0;
  const lineIndex = cart.findIndex((l) => l.lineId === selectedLineId);
  const selectedLine = lineIndex >= 0 ? cart[lineIndex] : null;
  const selectedView = selectedLine
    ? bill.lines.find((v) => v.line.lineId === selectedLine.lineId)
    : undefined;

  /** Bill-line keys work outside inputs, or in the search box while it is empty */
  const lineKeysAllowed = (e: KeyboardEvent) =>
    !isTyping(e.target) || (e.target === searchRef.current && !searching);

  const moveLine = (d: number) => {
    if (cart.length === 0) return;
    const next =
      lineIndex < 0
        ? d > 0
          ? 0
          : cart.length - 1
        : Math.max(0, Math.min(cart.length - 1, lineIndex + d));
    const id = cart[next].lineId;
    setSelectedLineId(id);
    setFocus((f) => ({ lineId: id, key: (f?.key ?? 0) + 1 }));
  };

  const bumpLine = (packs: number, loose: number) => {
    if (!selectedLine || !selectedView) return;
    const strip = Math.max(
      0,
      Math.min(selectedView.limits.maxStrip, selectedLine.qtyStrip + packs),
    );
    const lse = Math.max(
      0,
      Math.min(selectedView.limits.maxLoose, selectedLine.qtyLoose + loose),
    );
    // A line never drops to 0 — remove it with Delete instead
    if (strip + lse === 0) {
      toast.info("Quantity can't be 0 — press Delete to remove the line");
      return;
    }
    changeQty(selectedLine.lineId, strip, lse);
  };

  const nextPaymentMethod = () => {
    const methods = Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[];
    const i = methods.indexOf(payment.method);
    setPayment({ ...payment, method: methods[(i + 1) % methods.length] });
  };

  useHotkeys(
    [
      // Search & add
      { keys: KEYS.billSearch, handler: () => searchRef.current?.select() },
      {
        keys: "ArrowDown",
        allowInInputs: true,
        enabled: searching && results.length > 0,
        handler: () =>
          setFocusedIndex((i) => Math.min(i + 1, results.length - 1)),
      },
      {
        keys: "ArrowUp",
        allowInInputs: true,
        enabled: searching && results.length > 0,
        handler: () => setFocusedIndex((i) => Math.max(i - 1, 0)),
      },
      {
        keys: "Enter",
        allowInInputs: true,
        enabled: searching,
        when: (e) => e.target === searchRef.current,
        handler: () => {
          // Scanned barcode → that exact medicine, even before the list updates
          const scanned = byBarcode(query);
          if (scanned) addToCart(scanned);
          else if (results[focusedIndex]) addToCart(results[focusedIndex]);
        },
      },
      {
        keys: "Escape",
        allowInInputs: true,
        enabled: searching,
        handler: handleClearSearch,
      },

      // Bill lines (search box empty)
      {
        keys: "ArrowDown",
        allowInInputs: true,
        enabled: !searching,
        when: lineKeysAllowed,
        handler: () => moveLine(1),
      },
      {
        keys: "ArrowUp",
        allowInInputs: true,
        enabled: !searching,
        when: lineKeysAllowed,
        handler: () => moveLine(-1),
      },
      {
        keys: KEYS.qtyUp,
        allowInInputs: true,
        enabled: selectedLine !== null,
        when: lineKeysAllowed,
        handler: () => bumpLine(1, 0),
      },
      {
        keys: KEYS.qtyDown,
        allowInInputs: true,
        enabled: selectedLine !== null,
        when: lineKeysAllowed,
        handler: () => bumpLine(-1, 0),
      },
      {
        keys: KEYS.looseUp,
        allowInInputs: true,
        enabled: selectedLine !== null,
        when: lineKeysAllowed,
        handler: () => bumpLine(0, 1),
      },
      {
        keys: KEYS.looseDown,
        allowInInputs: true,
        enabled: selectedLine !== null,
        when: lineKeysAllowed,
        handler: () => bumpLine(0, -1),
      },
      {
        keys: KEYS.nextDiscount,
        allowInInputs: true,
        enabled: selectedLine !== null,
        when: lineKeysAllowed,
        handler: () => {
          if (!selectedLine) return;
          const i = (DISCOUNT_OPTIONS as readonly number[]).indexOf(
            selectedLine.discountPercent,
          );
          changeDiscount(
            selectedLine.lineId,
            DISCOUNT_OPTIONS[(i + 1) % DISCOUNT_OPTIONS.length],
          );
        },
      },
      {
        keys: KEYS.remove,
        allowInInputs: true,
        enabled: selectedLine !== null,
        when: lineKeysAllowed,
        handler: () => {
          if (!selectedLine) return;
          const nextId =
            cart[lineIndex + 1]?.lineId ?? cart[lineIndex - 1]?.lineId ?? null;
          removeLine(selectedLine.lineId);
          setSelectedLineId(nextId);
        },
      },

      // Bill actions (F-keys work everywhere on this screen)
      { keys: KEYS.customer, handler: () => customerRef.current?.select() },
      { keys: KEYS.nextPayment, handler: nextPaymentMethod },
      {
        keys: KEYS.payAmount,
        handler: () => {
          const el = amountRef.current;
          if (el) {
            el.focus();
            el.select();
          } else {
            toast.info(
              `${PAYMENT_METHOD_LABELS[payment.method]} needs no amount — press F9 to save`,
            );
          }
        },
      },
      { keys: KEYS.heldBills, handler: () => setHeldOpen(true) },
      { keys: KEYS.holdBill, enabled: cart.length > 0, handler: handleHold },
      { keys: KEYS.saveBill, handler: () => handleSave(false) },
      { keys: KEYS.savePrintBill, handler: () => handleSave(true) },
      { keys: KEYS.salesReturn, handler: () => setMode("return") },
      { keys: KEYS.clearBill, enabled: cart.length > 0, handler: resetBill },
    ],
    mode === "billing",
  );

  // ——— Sales Return mode ———
  if (mode === "return") {
    return (
      <div className="h-full w-full p-3 overflow-hidden box-border bg-background">
        <SalesReturnPanel
          initialSaleId={returnSaleId}
          onClose={() => {
            setReturnSaleId(null);
            setMode("billing");
            focusSearch();
          }}
        />
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
            gstin={customerGstin}
            onGstinChange={setCustomerGstin}
            canB2b={!!shopGstin}
            counter={counter}
            onCounterChange={setCounter}
            doctors={doctors}
            counters={counters}
            customerRef={customerRef}
          />

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex-1 min-w-0">
              <MedicineSearchBar
                query={query}
                onQueryChange={handleQueryChange}
                onClear={handleClearSearch}
                inputRef={searchRef}
              />
            </div>

            {cart.length > 0 && (
              <button
                type="button"
                onClick={resetBill}
                className="h-9 shrink-0 rounded-lg border border-border px-3 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                {tr("Clear All")}
                <Kbd keys={KEYS.clearBill} className="ml-1.5" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setHeldOpen(true)}
              className="h-9 shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 text-[11px] font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-500/15 transition-colors inline-flex items-center gap-1.5"
            >
              <PauseCircle className="h-3.5 w-3.5" />
              {tr("Held bills")}
              {held.length > 0 ? ` (${held.length})` : ""}
              <Kbd keys={KEYS.heldBills} />
            </button>

            <button
              type="button"
              onClick={() => setMode("return")}
              className="h-9 shrink-0 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 text-[11px] font-medium text-orange-700 dark:text-orange-400 hover:bg-orange-500/15 transition-colors inline-flex items-center gap-1.5"
            >
              {tr("Sales Return")}
              <Kbd keys={KEYS.salesReturn} />
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
              selectedLineId={selectedLineId}
              onSelectLine={setSelectedLineId}
              onBatchHistory={setHistoryBatchId}
            />
          ) : (
            <EmptyState
              icon={ShoppingCart}
              title="No items in this bill yet"
              description="Search a medicine above or scan its barcode to add it. Press F9 to save & print — one key bill."
            />
          )}

          <TodayBar
            onReturnBill={(id) => {
              setReturnSaleId(id);
              setMode("return");
            }}
          />
        </div>

        <div className="col-span-12 xl:col-span-3 min-h-0 overflow-hidden">
          <BillSummaryPanel
            billNo={billNo}
            interstate={
              !!customerGstin &&
              customerGstin.length === 15 &&
              !!shopGstin &&
              customerGstin.slice(0, 2) !== shopGstin.slice(0, 2)
            }
            lines={bill.lines}
            totals={bill.totals}
            payment={payment}
            onPaymentChange={setPayment}
            blockReason={blockReason}
            saving={saving}
            onSave={handleSave}
            onHold={handleHold}
            udhaarSlot={
              <CustomerAccountPicker
                customerId={udhaarCustomerId}
                netPaise={bill.totals.netPaise}
                initialQuery={customerName}
                onChange={(c) => {
                  setUdhaarCustomerId(c?.id ?? null);
                  if (c) setCustomerName(c.name);
                }}
              />
            }
            amountRef={setAmountRef}
          />
        </div>
      </div>

      <HeldBillsDialog
        open={heldOpen}
        held={held}
        cartHasItems={cart.length > 0}
        onResume={handleResume}
        onDiscard={(id) =>
          discardHeld(id).catch((err: unknown) =>
            toast.error(errorMessage(err, "Could not discard the bill")),
          )
        }
        onClose={() => setHeldOpen(false)}
      />

      <ReceiptDialog
        sale={receipt?.sale ?? null}
        autoPrint={receipt?.autoPrint ?? false}
        onClose={() => {
          setReceipt(null);
          focusSearch();
        }}
      />

      <BatchHistoryDialog
        batchId={historyBatchId}
        onClose={() => setHistoryBatchId(null)}
      />
    </div>
  );
}
