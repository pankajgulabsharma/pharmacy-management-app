import { useCallback, useDeferredValue, useMemo, useState } from "react";
import {
  AlertTriangle,
  IndianRupee,
  Plus,
  ReceiptText,
  Truck,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { SearchInput } from "@/components/common/SearchInput";
import {
  FilterChips,
  type FilterChipOption,
} from "@/components/common/FilterChips";
import { diffInDays, parseISODate, startOfDay } from "@/lib/date";
import { formatPaise, type Paise } from "@/lib/money";
import { useMedicinesWithStock } from "@/features/medicines/hooks/useMedicinesWithStock";
import { StockError } from "@/features/inventory/utils/ledger";
import { mockSuppliers } from "../data/mockSuppliers";
import { PurchaseError, usePurchaseStore } from "../store/usePurchaseStore";
import type { PaymentStatus, Purchase, PurchaseStatusFilter } from "../types";
import { getDuePaise, getPaymentStatus } from "../utils/calc";
import { purchaseMatchesQuery } from "../utils/search";
import { PurchaseTable } from "../components/PurchaseTable";
import { PurchaseFormDialog } from "../components/PurchaseFormDialog";
import { PurchaseDetailsDialog } from "../components/PurchaseDetailsDialog";

/** Window used by the summary cards */
const RECENT_DAYS = 30;

export default function PurchasesPage() {
  const purchases = usePurchaseStore((s) => s.purchases);
  const addPurchase = usePurchaseStore((s) => s.addPurchase);
  const recordPayment = usePurchaseStore((s) => s.recordPayment);
  // Medicines with live stock for the item picker
  const medicines = useMedicinesWithStock();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<PurchaseStatusFilter>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [today] = useState(() => startOfDay(new Date()));

  // Keeps typing responsive on large lists: filtering runs at lower priority
  const deferredQuery = useDeferredValue(query);

  /* Payment status depends on the date, so it is derived — never stored */
  const statusById = useMemo(() => {
    const map = new Map<string, PaymentStatus>();
    for (const p of purchases) map.set(p.id, getPaymentStatus(p, today));
    return map;
  }, [purchases, today]);

  const stats = useMemo(() => {
    let recentCount = 0;
    let recentTotal: Paise = 0;
    let outstanding: Paise = 0;
    let overdue = 0;
    const counts: Record<PaymentStatus, number> = {
      paid: 0,
      partial: 0,
      due: 0,
      overdue: 0,
    };

    for (const p of purchases) {
      const d = parseISODate(p.invoiceDate);
      if (d) {
        const age = diffInDays(today, d);
        if (age >= 0 && age < RECENT_DAYS) {
          recentCount++;
          recentTotal += p.totals.netPaise;
        }
      }
      outstanding += getDuePaise(p);
      const s = statusById.get(p.id) ?? "due";
      counts[s]++;
      if (s === "overdue") overdue++;
    }
    return { recentCount, recentTotal, outstanding, overdue, counts };
  }, [purchases, statusById, today]);

  const filtered = useMemo(
    () =>
      purchases.filter(
        (p) =>
          (statusFilter === "all" || statusById.get(p.id) === statusFilter) &&
          purchaseMatchesQuery(p, deferredQuery),
      ),
    [purchases, statusById, statusFilter, deferredQuery],
  );

  const filterOptions = useMemo<FilterChipOption<PurchaseStatusFilter>[]>(
    () => [
      { id: "all", label: "All", count: purchases.length },
      { id: "due", label: "Due", count: stats.counts.due },
      { id: "partial", label: "Partial", count: stats.counts.partial },
      { id: "overdue", label: "Overdue", count: stats.counts.overdue },
      { id: "paid", label: "Paid", count: stats.counts.paid },
    ],
    [purchases.length, stats.counts],
  );

  /* ---------------- handlers ---------------- */

  const openForm = useCallback(() => setFormOpen(true), []);
  const closeForm = useCallback(() => setFormOpen(false), []);
  const handleView = useCallback((p: Purchase) => setViewingId(p.id), []);
  const closeView = useCallback(() => setViewingId(null), []);

  const handleSave = useCallback(
    (p: Purchase): boolean => {
      try {
        const packs = addPurchase(p);
        setFormOpen(false);
        toast.success(`Purchase ${p.invoiceNo} saved`, {
          description: `₹${formatPaise(p.totals.netPaise)} · ${packs} packs added to Inventory`,
        });
        return true;
      } catch (err) {
        const known = err instanceof StockError || err instanceof PurchaseError;
        toast.error(known ? err.message : "Could not save purchase");
        return false;
      }
    },
    [addPurchase],
  );

  const handleRecordPayment = useCallback(
    (id: string, amountPaise: Paise) => {
      try {
        recordPayment(id, amountPaise);
        toast.success(`Payment of ₹${formatPaise(amountPaise)} recorded`);
      } catch (err) {
        toast.error(
          err instanceof PurchaseError
            ? err.message
            : "Could not record payment",
        );
      }
    },
    [recordPayment],
  );

  // Look up by id so the dialog always shows the latest version
  const viewing = viewingId
    ? (purchases.find((p) => p.id === viewingId) ?? null)
    : null;

  return (
    <div className="h-full w-full p-3 overflow-hidden box-border bg-background flex flex-col gap-2.5 min-h-0">
      <PageHeader
        icon={Truck}
        title="Purchases"
        subtitle="Supplier invoices · stock inward · payments"
        actions={
          <Button
            type="button"
            onClick={openForm}
            className="h-9 rounded-lg text-[12px] gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            New purchase
          </Button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0">
        <StatCard
          icon={ReceiptText}
          label={`Invoices · last ${RECENT_DAYS} days`}
          value={String(stats.recentCount)}
          iconClass="bg-primary/10 text-primary"
        />
        <StatCard
          icon={IndianRupee}
          label={`Purchased · last ${RECENT_DAYS} days`}
          value={`₹${formatPaise(stats.recentTotal)}`}
          iconClass="bg-emerald-500/10 text-emerald-600"
        />
        <StatCard
          icon={Wallet}
          label="Outstanding to suppliers"
          value={`₹${formatPaise(stats.outstanding)}`}
          iconClass="bg-orange-500/10 text-orange-600"
        />
        <StatCard
          icon={AlertTriangle}
          label="Overdue invoices"
          value={String(stats.overdue)}
          iconClass="bg-red-500/10 text-red-500"
        />
      </div>

      <div className="flex items-center gap-2 shrink-0 min-w-0">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search invoice, supplier, GSTIN, medicine, batch..."
        />
        <FilterChips
          options={filterOptions}
          value={statusFilter}
          onChange={setStatusFilter}
          ariaLabel="Filter by payment status"
        />
      </div>

      <p className="text-[10px] text-muted-foreground shrink-0">
        Showing {filtered.length} of {purchases.length} invoices
      </p>

      <PurchaseTable
        items={filtered}
        statusById={statusById}
        onView={handleView}
      />

      <PurchaseFormDialog
        open={formOpen}
        suppliers={mockSuppliers}
        medicines={medicines}
        existingPurchases={purchases}
        onClose={closeForm}
        onSave={handleSave}
      />

      <PurchaseDetailsDialog
        purchase={viewing}
        status={viewing ? (statusById.get(viewing.id) ?? null) : null}
        onClose={closeView}
        onRecordPayment={handleRecordPayment}
      />
    </div>
  );
}
