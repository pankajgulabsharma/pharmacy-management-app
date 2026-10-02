import { useCallback, useEffect, useMemo, useState } from "react";
import { ShoppingCart } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { newId } from "@/lib/id";
import { BillingContextBar } from "../components/BillingContextBar";
import { MedicineSearchBar } from "../components/MedicineSearchBar";
import { SearchResultsTable } from "../components/SearchResultsTable";
import { BillItemsTable } from "../components/BillItemsTable";
import { BillSummaryPanel } from "../components/BillSummaryPanel";
import { BillingBottomStats } from "../components/BillingBottomStats";
import { SalesReturnPanel } from "../components/SalesReturnPanel";
import {
  medicineSearchResults,
  doctorsMock,
  countersMock,
  type MedicineSearchResult,
} from "../data/mockBillingData";
import type { BillLineItem, PaymentMethod } from "../types";

export default function BillingPage() {
  const [mode, setMode] = useState<"billing" | "return">("billing");

  const [customerName, setCustomerName] = useState(
    "Pankaj Sharma (9876543210)",
  );
  const [prescribedBy, setPrescribedBy] = useState(doctorsMock[0] ?? "");
  const [counter, setCounter] = useState(countersMock[0] ?? "Counter 1");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [billItems, setBillItems] = useState<BillLineItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [receivedAmount, setReceivedAmount] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return medicineSearchResults.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.brand.toLowerCase().includes(q) ||
        m.batch.toLowerCase().includes(q) ||
        m.hsn.includes(q),
    );
  }, [query]);

  // Reset the highlighted result whenever the search text changes
  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    setFocusedIndex(0);
    setSelectedId(null);
  }, []);

  const addToBill = useCallback((medicine: MedicineSearchResult) => {
    const inStock = medicine.stockStrip > 0 || medicine.stockLoose > 0;
    if (!inStock) return;

    const safeMedicine: MedicineSearchResult = {
      ...medicine,
      unitsPerStrip:
        medicine.unitsPerStrip && medicine.unitsPerStrip > 0
          ? medicine.unitsPerStrip
          : 10,
    };

    setBillItems((prev) => {
      const existing = prev.find((l) => l.medicine.id === safeMedicine.id);
      if (existing) {
        return prev.map((l) =>
          l.lineId === existing.lineId ? { ...l, qtyStrip: l.qtyStrip + 1 } : l,
        );
      }
      return [
        ...prev,
        {
          lineId: newId("line"),
          medicine: safeMedicine,
          qtyStrip: 1,
          qtyLoose: 0,
          discountPercent: 0,
        },
      ];
    });

    setSelectedId(safeMedicine.id);
    setQuery("");
    setFocusedIndex(0);
  }, []);

  const handleClearSearch = useCallback(() => {
    setQuery("");
    setSelectedId(null);
    setFocusedIndex(0);
  }, []);

  const handleClearAll = useCallback(() => {
    setBillItems([]);
    setReceivedAmount("");
  }, []);

  useEffect(() => {
    if (mode !== "billing") return;

    const onKeyDown = (e: KeyboardEvent) => {
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
        if (item) addToBill(item);
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleClearSearch();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mode, query, results, focusedIndex, addToBill, handleClearSearch]);

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
            prescribedBy={prescribedBy}
            onPrescribedByChange={setPrescribedBy}
            counter={counter}
            onCounterChange={setCounter}
            doctors={doctorsMock}
            counters={countersMock}
          />

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex-1 min-w-0">
              <MedicineSearchBar
                query={query}
                onQueryChange={handleQueryChange}
                onClear={handleClearSearch}
              />
            </div>

            {billItems.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="h-9 shrink-0 rounded-lg border border-border px-3 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                Clear All
              </button>
            )}

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
              selectedId={selectedId}
              focusedIndex={focusedIndex}
              onSelect={addToBill}
              onHoverIndex={setFocusedIndex}
            />
          ) : billItems.length > 0 ? (
            <BillItemsTable
              items={billItems}
              onChangeQty={(lineId, qtyStrip, qtyLoose) => {
                setBillItems((prev) =>
                  prev.map((l) =>
                    l.lineId === lineId ? { ...l, qtyStrip, qtyLoose } : l,
                  ),
                );
              }}
              onChangeDiscount={(lineId, discountPercent) => {
                setBillItems((prev) =>
                  prev.map((l) =>
                    l.lineId === lineId ? { ...l, discountPercent } : l,
                  ),
                );
              }}
              onRemove={(lineId) => {
                setBillItems((prev) => prev.filter((l) => l.lineId !== lineId));
              }}
            />
          ) : (
            <EmptyState
              icon={ShoppingCart}
              title="No items in this bill yet"
              description="Search a medicine above or scan its barcode to add it."
            />
          )}

          <BillingBottomStats />
        </div>

        <div className="col-span-12 xl:col-span-3 min-h-0 overflow-hidden">
          <BillSummaryPanel
            billNo="#INV-0048"
            items={billItems}
            paymentMethod={paymentMethod}
            onPaymentMethodChange={setPaymentMethod}
            receivedAmount={receivedAmount}
            onReceivedAmountChange={setReceivedAmount}
            customerName={customerName}
          />
        </div>
      </div>
    </div>
  );
}
