import { useCallback, useDeferredValue, useMemo, useState } from "react";
import {
  AlertTriangle,
  Package,
  PackageX,
  Pill,
  Plus,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { SearchInput } from "@/components/common/SearchInput";
import { FilterSelect } from "@/components/common/FilterSelect";
import {
  FilterChips,
  type FilterChipOption,
} from "@/components/common/FilterChips";
import type {
  MedicineCategory,
  MedicineFormValues,
  MedicineInput,
  MedicineWithStock,
} from "../types";
import { CATEGORY_LABELS } from "../types";
import { useMedicineStore } from "../store/useMedicineStore";
import { useMedicinesWithStock } from "../hooks/useMedicinesWithStock";
import { MedicineTable } from "../components/MedicineTable";
import { MedicineFormDialog } from "../components/MedicineFormDialog";
import { MedicineImportDialog } from "../components/MedicineImportDialog";
import { MedicineDeleteDialog } from "../components/MedicineDeleteDialog";
import { medicineMatchesQuery } from "../utils/search";

type StatusFilter = "all" | "active" | "inactive" | "low";
type CategoryFilter = "all" | MedicineCategory;

const CATEGORY_OPTIONS: { value: CategoryFilter; label: string }[] = [
  { value: "all", label: "All categories" },
  ...(Object.keys(CATEGORY_LABELS) as MedicineCategory[]).map((key) => ({
    value: key,
    label: CATEGORY_LABELS[key],
  })),
];

function isOut(m: MedicineWithStock) {
  return m.stockStrip === 0 && m.stockLoose === 0;
}

function isLowOrOut(m: MedicineWithStock) {
  return isOut(m) || m.stockStrip < m.minStock;
}

/** Form strings → typed master input (the store sanitises again) */
function formToInput(v: MedicineFormValues): MedicineInput {
  return {
    name: v.name,
    salt: v.salt,
    brand: v.brand,
    category: v.category,
    hsn: v.hsn,
    barcode: v.barcode,
    rack: v.rack,
    unit: v.unit,
    unitsPerStrip: Number(v.unitsPerStrip) || 1,
    allowLoose: v.allowLoose,
    mrp: Number(v.mrp) || 0,
    salePrice: Number(v.salePrice) || 0,
    minStock: Number(v.minStock) || 0,
    gstPercent: v.gstPercent,
    status: v.status,
  };
}

export default function MedicinesPage() {
  // Master data + live stock from inventory (single source of truth)
  const items = useMedicinesWithStock();
  const addMedicine = useMedicineStore((s) => s.addMedicine);
  const updateMedicine = useMedicineStore((s) => s.updateMedicine);
  const removeMedicine = useMedicineStore((s) => s.removeMedicine);
  const importMedicines = useMedicineStore((s) => s.importMedicines);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<MedicineWithStock | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MedicineWithStock | null>(
    null,
  );

  // Filtering runs at lower priority so typing stays smooth on big lists
  const deferredQuery = useDeferredValue(query);

  const stats = useMemo(() => {
    let active = 0;
    let inactive = 0;
    let low = 0;
    let out = 0;
    for (const m of items) {
      if (m.status === "active") active++;
      else inactive++;
      if (m.status === "active" && isLowOrOut(m)) low++;
      if (isOut(m)) out++;
    }
    return { total: items.length, active, inactive, low, out };
  }, [items]);

  const filtered = useMemo(
    () =>
      items.filter((m) => {
        if (statusFilter === "active" && m.status !== "active") return false;
        if (statusFilter === "inactive" && m.status !== "inactive")
          return false;
        if (statusFilter === "low" && !isLowOrOut(m)) return false;
        if (categoryFilter !== "all" && m.category !== categoryFilter)
          return false;
        return medicineMatchesQuery(m, deferredQuery);
      }),
    [items, deferredQuery, statusFilter, categoryFilter],
  );

  const filterOptions = useMemo<FilterChipOption<StatusFilter>[]>(
    () => [
      { id: "all", label: "All", count: stats.total },
      { id: "active", label: "Active", count: stats.active },
      { id: "low", label: "Low / Out", count: stats.low },
      { id: "inactive", label: "Inactive", count: stats.inactive },
    ],
    [stats],
  );

  /* ---------------- handlers ---------------- */

  const openAdd = useCallback(() => {
    setEditing(null);
    setDialogOpen(true);
  }, []);

  const openEdit = useCallback((m: MedicineWithStock) => {
    setEditing(m);
    setDialogOpen(true);
  }, []);

  const closeForm = useCallback(() => {
    setDialogOpen(false);
    setEditing(null);
  }, []);

  const openImport = useCallback(() => setImportOpen(true), []);
  const closeImport = useCallback(() => setImportOpen(false), []);
  const closeDelete = useCallback(() => setDeleteTarget(null), []);

  const handleDeleteConfirm = useCallback(
    (id: string) => {
      const target = items.find((m) => m.id === id);
      // Same rule as the dialog — never orphan batches that hold stock
      if (target && !isOut(target)) {
        toast.error("This medicine still has stock and can't be deleted");
        return;
      }
      removeMedicine(id);
      setDeleteTarget(null);
      toast.success(target ? `"${target.name}" deleted` : "Medicine deleted");
    },
    [items, removeMedicine],
  );

  const handleSave = useCallback(
    (values: MedicineFormValues, editId: string | null) => {
      const input = formToInput(values);
      if (editId) updateMedicine(editId, input);
      else addMedicine(input);
      setDialogOpen(false);
      setEditing(null);
      toast.success(editId ? "Medicine updated" : "Medicine added");
    },
    [addMedicine, updateMedicine],
  );

  const handleImport = useCallback(
    (rows: MedicineInput[]) => {
      const count = importMedicines(rows);
      toast.success(`${count} medicine(s) imported`);
    },
    [importMedicines],
  );

  return (
    <div className="h-full w-full p-3 overflow-hidden box-border bg-background flex flex-col gap-2.5 min-h-0">
      <PageHeader
        icon={Pill}
        title="Medicines"
        subtitle="Master list · category, pack, price & stock"
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-lg text-[12px] gap-1.5"
              onClick={openImport}
            >
              <Upload className="h-3.5 w-3.5" />
              Import CSV
            </Button>
            <Button
              type="button"
              onClick={openAdd}
              className="h-9 rounded-lg text-[12px] gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Medicine
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0">
        <StatCard
          icon={Package}
          label="Total"
          value={String(stats.total)}
          iconClass="bg-primary/10 text-primary"
        />
        <StatCard
          icon={Pill}
          label="Active"
          value={String(stats.active)}
          iconClass="bg-emerald-500/10 text-emerald-600"
        />
        <StatCard
          icon={AlertTriangle}
          label="Low stock"
          value={String(stats.low)}
          iconClass="bg-orange-500/10 text-orange-600"
        />
        <StatCard
          icon={PackageX}
          label="Out of stock"
          value={String(stats.out)}
          iconClass="bg-red-500/10 text-red-500"
        />
      </div>

      <div className="flex items-center gap-2 shrink-0 min-w-0">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search name, salt, brand, category..."
        />
        <FilterSelect
          value={categoryFilter}
          options={CATEGORY_OPTIONS}
          onChange={setCategoryFilter}
          ariaLabel="Filter by category"
        />
        <FilterChips
          options={filterOptions}
          value={statusFilter}
          onChange={setStatusFilter}
          ariaLabel="Filter by status"
        />
      </div>

      <p className="text-[10px] text-muted-foreground shrink-0">
        Showing {filtered.length} of {items.length}
      </p>

      <MedicineTable
        items={filtered}
        onEdit={openEdit}
        onDelete={setDeleteTarget}
      />

      <MedicineFormDialog
        open={dialogOpen}
        medicine={editing}
        onClose={closeForm}
        onSave={handleSave}
      />

      <MedicineImportDialog
        open={importOpen}
        onClose={closeImport}
        onImport={handleImport}
      />

      <MedicineDeleteDialog
        open={Boolean(deleteTarget)}
        medicine={deleteTarget}
        onClose={closeDelete}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
