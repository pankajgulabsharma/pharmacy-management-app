import {
  useCallback,
  useDeferredValue,
  useMemo,
  useState,
  useRef,
} from "react";
import {
  AlertTriangle,
  BadgeIndianRupee,
  Building2,
  Plus,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { SearchInput } from "@/components/common/SearchInput";
import { KeyHints } from "@/components/common/KeyHints";
import { useHotkeys } from "@/hooks/useHotkeys";
import { useListNavigation } from "@/hooks/useListNavigation";
import { oneOf, useUrlIntent } from "@/hooks/useUrlIntent";
import { KEYS } from "@/app/shortcuts/registry";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import {
  FilterChips,
  type FilterChipOption,
} from "@/components/common/FilterChips";
import { startOfDay } from "@/lib/date";
import { inrFromPaise } from "@/lib/money";
import { usePurchaseStore } from "@/features/purchases/store/usePurchaseStore";
import { SupplierError, useSupplierStore } from "../store/useSupplierStore";
import { useSupplierSummaries } from "../hooks/useSupplierSummaries";
import type { SupplierFormValues, SupplierWithSummary } from "../types";
import { formToSupplierInput } from "../utils/validation";
import { supplierMatchesQuery } from "../utils/search";
import { SupplierTable } from "../components/SupplierTable";
import {
  SUPPLIER_STATUS_LABEL,
  supplierStatus,
  type SupplierStatus,
} from "../utils/status";
import { SupplierFormDialog } from "../components/SupplierFormDialog";
import { SupplierDetailsDialog } from "../components/SupplierDetailsDialog";

/** "All" + one chip per status; chips never overlap and add up to All */
type Filter = "all" | SupplierStatus;
const FILTERS: readonly Filter[] = [
  "all",
  "overdue",
  "due",
  "credit",
  "settled",
  "inactive",
];

export default function SuppliersPage() {
  const [today] = useState(() => startOfDay(new Date()));
  const items = useSupplierSummaries(today);
  const suppliers = useSupplierStore((s) => s.suppliers);
  const addSupplier = useSupplierStore((s) => s.addSupplier);
  const updateSupplier = useSupplierStore((s) => s.updateSupplier);
  const removeSupplier = useSupplierStore((s) => s.removeSupplier);
  const purchases = usePurchaseStore((s) => s.purchases);
  const returns = usePurchaseStore((s) => s.returns);

  // Dashboard links like /suppliers?filter=overdue or ?new=1
  const intent = useUrlIntent();
  const [query, setQuery] = useState(intent.q?.slice(0, 80) ?? "");
  const [filter, setFilter] = useState<Filter>(
    oneOf(intent.filter, FILTERS, "all"),
  );
  const searchRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<{ open: boolean; editId: string | null }>({
    open: intent.new === "1",
    editId: null,
  });
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const deferredQuery = useDeferredValue(query);

  const stats = useMemo(() => {
    const out = {
      active: 0,
      outstanding: 0,
      overdue: 0,
      overdueCount: 0,
      credit: 0,
    };
    const counts: Record<Filter, number> = {
      all: items.length,
      overdue: 0,
      due: 0,
      credit: 0,
      settled: 0,
      inactive: 0,
    };
    for (const s of items) {
      if (s.status === "active") out.active++;
      out.outstanding += s.outstandingPaise;
      out.overdue += s.overduePaise;
      out.credit += s.creditPaise;
      if (s.overduePaise > 0) out.overdueCount++;
      counts[supplierStatus(s)]++;
    }
    return { ...out, counts };
  }, [items]);

  const filtered = useMemo(() => {
    return (
      items
        .filter(
          (s) =>
            (filter === "all" || supplierStatus(s) === filter) &&
            supplierMatchesQuery(s, deferredQuery),
        )
        // Most money owed first — what a shop owner checks first
        .sort(
          (a, b) =>
            b.outstandingPaise - a.outstandingPaise ||
            a.name.localeCompare(b.name),
        )
    );
  }, [items, filter, deferredQuery]);

  const filterOptions = useMemo<FilterChipOption<Filter>[]>(
    () => [
      { id: "all", label: "All", count: stats.counts.all },
      ...FILTERS.filter((f): f is SupplierStatus => f !== "all").map((f) => ({
        id: f,
        label: SUPPLIER_STATUS_LABEL[f],
        count: stats.counts[f],
      })),
    ],
    [stats.counts],
  );

  const byId = useMemo(() => new Map(items.map((s) => [s.id, s])), [items]);

  /* ---------------- handlers ---------------- */

  const openAdd = useCallback(() => setForm({ open: true, editId: null }), []);
  const openEdit = useCallback(
    (s: SupplierWithSummary) => setForm({ open: true, editId: s.id }),
    [],
  );
  const closeForm = useCallback(
    () => setForm({ open: false, editId: null }),
    [],
  );
  const openView = useCallback(
    (s: SupplierWithSummary) => setViewingId(s.id),
    [],
  );
  const closeView = useCallback(() => setViewingId(null), []);
  const askDelete = useCallback(
    (s: SupplierWithSummary) => setDeleteId(s.id),
    [],
  );
  const closeDelete = useCallback(() => setDeleteId(null), []);

  const handleSave = useCallback(
    (values: SupplierFormValues, editId: string | null): boolean => {
      try {
        const input = formToSupplierInput(values);
        if (editId) updateSupplier(editId, input);
        else addSupplier(input);
        setForm({ open: false, editId: null });
        toast.success(editId ? "Supplier updated" : "Supplier added");
        return true;
      } catch (err) {
        toast.error(
          err instanceof SupplierError
            ? err.message
            : "Could not save supplier",
        );
        return false;
      }
    },
    [addSupplier, updateSupplier],
  );

  const handleDelete = useCallback(() => {
    if (!deleteId) return;
    // Same guard as the button — never orphan invoices or debit notes
    const used =
      purchases.some((p) => p.supplierId === deleteId) ||
      returns.some((r) => r.supplierId === deleteId);
    if (used) {
      toast.error("This supplier has invoices — set it Inactive instead");
      return;
    }
    const name = byId.get(deleteId)?.name ?? "Supplier";
    removeSupplier(deleteId);
    setDeleteId(null);
    setViewingId(null);
    toast.success(`${name} deleted`);
  }, [deleteId, purchases, returns, byId, removeSupplier]);

  const editing = form.editId
    ? (suppliers.find((s) => s.id === form.editId) ?? null)
    : null;
  const viewing = viewingId ? (byId.get(viewingId) ?? null) : null;
  const deleting = deleteId ? (byId.get(deleteId) ?? null) : null;

  // Keyboard: ↑↓ select · Enter view · E edit · N new · / search
  const nav = useListNavigation({
    items: filtered,
    getKey: (x: SupplierWithSummary) => x.id,
    onOpen: openView,
  });
  useHotkeys([
    { keys: KEYS.focusSearch, handler: () => searchRef.current?.select() },
    { keys: KEYS.create, handler: openAdd },
    {
      keys: KEYS.edit,
      enabled: nav.selected !== null,
      handler: () => nav.selected && openEdit(nav.selected),
    },
  ]);

  return (
    <div className="h-full w-full p-3 overflow-hidden box-border bg-background flex flex-col gap-2.5 min-h-0">
      <PageHeader
        icon={Building2}
        title="Suppliers"
        subtitle="Distributors · GSTIN · credit terms · balances"
        actions={
          <Button
            type="button"
            onClick={openAdd}
            className="h-9 rounded-lg text-[12px] gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Add supplier
          </Button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0">
        <StatCard
          icon={Users}
          label="Active suppliers"
          value={String(stats.active)}
          iconClass="bg-primary/10 text-primary"
        />
        <StatCard
          icon={Wallet}
          label="Outstanding to suppliers"
          value={inrFromPaise(stats.outstanding)}
          iconClass="bg-orange-500/10 text-orange-600"
        />
        <StatCard
          icon={AlertTriangle}
          label={`Overdue · ${stats.overdueCount} suppliers`}
          value={inrFromPaise(stats.overdue)}
          iconClass="bg-red-500/10 text-red-500"
        />
        <StatCard
          icon={BadgeIndianRupee}
          label="Credit with suppliers"
          value={inrFromPaise(stats.credit)}
          iconClass="bg-emerald-500/10 text-emerald-600"
        />
      </div>

      <div className="flex items-center gap-2 shrink-0 min-w-0">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search name, GSTIN, phone, city, licence..."
          inputRef={searchRef}
        />
        <FilterChips
          options={filterOptions}
          value={filter}
          onChange={setFilter}
          ariaLabel="Filter suppliers"
        />
      </div>

      <div className="flex items-center justify-between gap-3 shrink-0">
        <p className="text-[10px] text-muted-foreground">
          Showing {filtered.length} of {items.length} · sorted by amount owed
        </p>
        <KeyHints
          hints={[
            { keys: "/", label: "Search" },
            { keys: ["ArrowUp", "ArrowDown"], label: "Move" },
            { keys: "Enter", label: "View" },
            { keys: "E", label: "Edit" },
            { keys: "N", label: "New supplier" },
          ]}
        />
      </div>

      <SupplierTable
        items={filtered}
        onView={openView}
        onEdit={openEdit}
        selectedId={nav.selectedKey}
        onSelect={nav.select}
      />

      <SupplierDetailsDialog
        supplier={viewing}
        today={today}
        onClose={closeView}
        onEdit={openEdit}
        onDelete={askDelete}
      />

      <SupplierFormDialog
        open={form.open}
        supplier={editing}
        existing={suppliers}
        onClose={closeForm}
        onSave={handleSave}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete ${deleting?.name ?? "supplier"}?`}
        description="This supplier has no invoices or returns, so it can be removed permanently."
        confirmLabel="Delete supplier"
        onConfirm={handleDelete}
        onClose={closeDelete}
      />
    </div>
  );
}
