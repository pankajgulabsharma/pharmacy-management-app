import { useCallback, useDeferredValue, useMemo, useState } from "react";
import {
  AlertTriangle,
  FileText,
  IndianRupee,
  Plus,
  ReceiptText,
  Truck,
  Undo2,
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
import {
  SegmentedTabs,
  type SegmentedTab,
} from "@/components/common/SegmentedTabs";
import { diffInDays, parseISODate, startOfDay } from "@/lib/date";
import { formatPaise, inrFromPaise, type Paise } from "@/lib/money";
import { useMedicinesWithStock } from "@/features/medicines/hooks/useMedicinesWithStock";
import { useSupplierStore } from "@/features/suppliers/store/useSupplierStore";
import { StockError } from "@/features/inventory/utils/ledger";
import { PurchaseError, usePurchaseStore } from "../store/usePurchaseStore";
import type {
  PaymentStatus,
  Purchase,
  PurchaseReturn,
  PurchaseReturnInput,
  PurchaseStatusFilter,
} from "../types";
import { getDuePaise, getPaymentStatus } from "../utils/calc";
import { ReturnError } from "../utils/returns";
import { purchaseMatchesQuery, returnMatchesQuery } from "../utils/search";
import { PurchaseTable } from "../components/PurchaseTable";
import { PurchaseFormDialog } from "../components/PurchaseFormDialog";
import { PurchaseDetailsDialog } from "../components/PurchaseDetailsDialog";
import { CancelPurchaseDialog } from "../components/CancelPurchaseDialog";
import { PurchaseReturnDialog } from "../components/PurchaseReturnDialog";
import { ReturnTable } from "../components/ReturnTable";
import { ReturnDetailsDialog } from "../components/ReturnDetailsDialog";

/** Window used by the summary cards */
const RECENT_DAYS = 30;

type Tab = "invoices" | "returns";

/** Show domain errors as-is; hide anything unexpected behind a generic message */
function errorMessage(err: unknown, fallback: string) {
  const known =
    err instanceof PurchaseError ||
    err instanceof StockError ||
    err instanceof ReturnError;
  return known ? err.message : fallback;
}

export default function PurchasesPage() {
  const purchases = usePurchaseStore((s) => s.purchases);
  const returns = usePurchaseStore((s) => s.returns);
  const addPurchase = usePurchaseStore((s) => s.addPurchase);
  const updatePurchase = usePurchaseStore((s) => s.updatePurchase);
  const cancelPurchase = usePurchaseStore((s) => s.cancelPurchase);
  const createReturn = usePurchaseStore((s) => s.createReturn);
  const recordPayment = usePurchaseStore((s) => s.recordPayment);
  const suppliers = useSupplierStore((s) => s.suppliers);
  const medicines = useMedicinesWithStock();

  const [tab, setTab] = useState<Tab>("invoices");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<PurchaseStatusFilter>("all");
  const [today] = useState(() => startOfDay(new Date()));

  // Dialogs — ids, not objects, so dialogs always show the latest version
  const [form, setForm] = useState<{ open: boolean; editingId: string | null }>(
    {
      open: false,
      editingId: null,
    },
  );
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [returnForId, setReturnForId] = useState<string | null>(null);
  const [viewingReturnId, setViewingReturnId] = useState<string | null>(null);

  const deferredQuery = useDeferredValue(query);

  const byId = useMemo(
    () => new Map(purchases.map((p) => [p.id, p])),
    [purchases],
  );

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
      cancelled: 0,
    };

    for (const p of purchases) {
      const s = statusById.get(p.id) ?? "due";
      counts[s]++;
      if (p.status === "cancelled") continue;
      const d = parseISODate(p.invoiceDate);
      if (d) {
        const age = diffInDays(today, d);
        if (age >= 0 && age < RECENT_DAYS) {
          recentCount++;
          recentTotal += p.totals.netPaise;
        }
      }
      outstanding += getDuePaise(p);
      if (s === "overdue") overdue++;
    }
    return { recentCount, recentTotal, outstanding, overdue, counts };
  }, [purchases, statusById, today]);

  const filteredPurchases = useMemo(
    () =>
      purchases.filter(
        (p) =>
          (statusFilter === "all" || statusById.get(p.id) === statusFilter) &&
          purchaseMatchesQuery(p, deferredQuery),
      ),
    [purchases, statusById, statusFilter, deferredQuery],
  );

  const filteredReturns = useMemo(
    () => returns.filter((r) => returnMatchesQuery(r, deferredQuery)),
    [returns, deferredQuery],
  );

  const tabs = useMemo<SegmentedTab<Tab>[]>(
    () => [
      {
        id: "invoices",
        label: "Invoices",
        icon: FileText,
        count: purchases.length,
      },
      { id: "returns", label: "Returns", icon: Undo2, count: returns.length },
    ],
    [purchases.length, returns.length],
  );

  const filterOptions = useMemo<FilterChipOption<PurchaseStatusFilter>[]>(
    () => [
      { id: "all", label: "All", count: purchases.length },
      { id: "due", label: "Due", count: stats.counts.due },
      { id: "partial", label: "Partial", count: stats.counts.partial },
      { id: "overdue", label: "Overdue", count: stats.counts.overdue },
      { id: "paid", label: "Paid", count: stats.counts.paid },
      { id: "cancelled", label: "Cancelled", count: stats.counts.cancelled },
    ],
    [purchases.length, stats.counts],
  );

  /* ---------------- handlers ---------------- */

  const openNew = useCallback(
    () => setForm({ open: true, editingId: null }),
    [],
  );
  const openEdit = useCallback(
    (p: Purchase) => setForm({ open: true, editingId: p.id }),
    [],
  );
  const closeForm = useCallback(
    () => setForm({ open: false, editingId: null }),
    [],
  );
  const handleView = useCallback((p: Purchase) => setViewingId(p.id), []);
  const closeView = useCallback(() => setViewingId(null), []);
  const openCancel = useCallback((p: Purchase) => setCancelId(p.id), []);
  const closeCancel = useCallback(() => setCancelId(null), []);
  const openReturn = useCallback((p: Purchase) => setReturnForId(p.id), []);
  const closeReturn = useCallback(() => setReturnForId(null), []);
  const handleViewReturn = useCallback(
    (r: PurchaseReturn) => setViewingReturnId(r.id),
    [],
  );
  const closeReturnView = useCallback(() => setViewingReturnId(null), []);

  const handleSave = useCallback(
    (p: Purchase, mode: "create" | "edit"): boolean => {
      try {
        if (mode === "edit") {
          updatePurchase(p);
          toast.success(`Invoice ${p.invoiceNo} updated (rev ${p.revision})`, {
            description: "Stock was re-posted to match the corrected invoice",
          });
        } else {
          const packs = addPurchase(p);
          toast.success(`Purchase ${p.invoiceNo} saved`, {
            description: `₹${formatPaise(p.totals.netPaise)} · ${packs} packs added to Inventory`,
          });
        }
        setForm({ open: false, editingId: null });
        return true;
      } catch (err) {
        toast.error(errorMessage(err, "Could not save purchase"));
        return false;
      }
    },
    [addPurchase, updatePurchase],
  );

  const handleCancel = useCallback(
    (id: string, reason: string) => {
      try {
        cancelPurchase(id, reason);
        setCancelId(null);
        toast.success("Invoice cancelled", {
          description: "Its stock was removed from inventory",
        });
      } catch (err) {
        toast.error(errorMessage(err, "Could not cancel the invoice"));
      }
    },
    [cancelPurchase],
  );

  const handleCreateReturn = useCallback(
    (input: PurchaseReturnInput): boolean => {
      try {
        const ret = createReturn(input);
        setReturnForId(null);
        toast.success(`Debit note ${ret.returnNo} created`, {
          description: `${ret.totalQty} packs · ${inrFromPaise(ret.totalPaise)} credit`,
        });
        return true;
      } catch (err) {
        toast.error(errorMessage(err, "Could not create the return"));
        return false;
      }
    },
    [createReturn],
  );

  const handleRecordPayment = useCallback(
    (id: string, amountPaise: Paise) => {
      try {
        recordPayment(id, amountPaise);
        toast.success(`Payment of ₹${formatPaise(amountPaise)} recorded`);
      } catch (err) {
        toast.error(errorMessage(err, "Could not record payment"));
      }
    },
    [recordPayment],
  );

  const viewing = viewingId ? (byId.get(viewingId) ?? null) : null;
  const editing = form.editingId ? (byId.get(form.editingId) ?? null) : null;
  const viewingReturn = viewingReturnId
    ? (returns.find((r) => r.id === viewingReturnId) ?? null)
    : null;

  return (
    <div className="h-full w-full p-3 overflow-hidden box-border bg-background flex flex-col gap-2.5 min-h-0">
      <PageHeader
        icon={Truck}
        title="Purchases"
        subtitle="Supplier invoices · returns · payments"
        actions={
          <Button
            type="button"
            onClick={openNew}
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
          value={inrFromPaise(stats.recentTotal)}
          iconClass="bg-emerald-500/10 text-emerald-600"
        />
        <StatCard
          icon={Wallet}
          label="Outstanding to suppliers"
          value={inrFromPaise(stats.outstanding)}
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
        <SegmentedTabs
          tabs={tabs}
          value={tab}
          onChange={setTab}
          ariaLabel="Purchases view"
        />
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder={
            tab === "invoices"
              ? "Search invoice, supplier, GSTIN, medicine, batch..."
              : "Search debit note, supplier, invoice, medicine..."
          }
        />
        {tab === "invoices" ? (
          <FilterChips
            options={filterOptions}
            value={statusFilter}
            onChange={setStatusFilter}
            ariaLabel="Filter by payment status"
          />
        ) : null}
      </div>

      <p className="text-[10px] text-muted-foreground shrink-0">
        {tab === "invoices"
          ? `Showing ${filteredPurchases.length} of ${purchases.length} invoices`
          : `Showing ${filteredReturns.length} of ${returns.length} debit notes`}
      </p>

      {tab === "invoices" ? (
        <PurchaseTable
          items={filteredPurchases}
          statusById={statusById}
          onView={handleView}
        />
      ) : (
        <ReturnTable items={filteredReturns} onView={handleViewReturn} />
      )}

      {/* Dialogs — order matters: later ones stack on top */}
      <PurchaseDetailsDialog
        purchase={viewing}
        status={viewing ? (statusById.get(viewing.id) ?? null) : null}
        onClose={closeView}
        onRecordPayment={handleRecordPayment}
        onEdit={openEdit}
        onCancel={openCancel}
        onReturn={openReturn}
        onViewReturn={handleViewReturn}
      />

      <PurchaseFormDialog
        open={form.open}
        editing={editing}
        suppliers={suppliers}
        medicines={medicines}
        existingPurchases={purchases}
        onClose={closeForm}
        onSave={handleSave}
      />

      <CancelPurchaseDialog
        purchase={cancelId ? (byId.get(cancelId) ?? null) : null}
        onClose={closeCancel}
        onConfirm={handleCancel}
      />

      <PurchaseReturnDialog
        purchase={returnForId ? (byId.get(returnForId) ?? null) : null}
        onClose={closeReturn}
        onSubmit={handleCreateReturn}
      />

      <ReturnDetailsDialog ret={viewingReturn} onClose={closeReturnView} />
    </div>
  );
}
