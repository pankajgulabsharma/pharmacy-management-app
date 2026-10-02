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
import { newId } from "@/lib/id";
import { cleanCode, cleanText } from "@/lib/sanitize";
import { mockMedicines } from "../data/mockMedicines";
import type { Medicine, MedicineCategory, MedicineFormValues } from "../types";
import { CATEGORY_LABELS } from "../types";
import { MedicineTable } from "../components/MedicineTable";
import { MedicineFormDialog } from "../components/MedicineFormDialog";
import { MedicineImportDialog } from "../components/MedicineImportDialog";
import { MedicineDeleteDialog } from "../components/MedicineDeleteDialog";
import { medicineMatchesQuery } from "../utils/search";

type StatusFilter = "all" | "active" | "inactive" | "low";
type CategoryFilter = "all" | MedicineCategory;
type ImportRow = Omit<
  Medicine,
  "id" | "stockStrip" | "stockLoose" | "nearestExpiry"
>;

const CATEGORY_OPTIONS: { value: CategoryFilter; label: string }[] = [
  { value: "all", label: "All categories" },
  ...(Object.keys(CATEGORY_LABELS) as MedicineCategory[]).map((key) => ({
    value: key,
    label: CATEGORY_LABELS[key],
  })),
];

function isOut(m: Medicine) {
  return m.stockStrip === 0 && m.stockLoose === 0;
}

function isLowOrOut(m: Medicine) {
  return isOut(m) || m.stockStrip < m.minStock;
}

export default function MedicinesPage() {
  const [items, setItems] = useState<Medicine[]>(mockMedicines);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Medicine | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Medicine | null>(null);

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

  const openEdit = useCallback((m: Medicine) => {
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

  const deleteName = deleteTarget?.name;
  const handleDeleteConfirm = useCallback(
    (id: string) => {
      setItems((prev) => prev.filter((m) => m.id !== id));
      setDeleteTarget(null);
      toast.success(
        deleteName ? `"${deleteName}" deleted` : "Medicine deleted",
      );
    },
    [deleteName],
  );

  const handleSave = useCallback(
    (values: MedicineFormValues, editId: string | null) => {
      const payload = {
        name: cleanText(values.name, 120),
        salt: cleanText(values.salt, 160),
        brand: cleanText(values.brand, 80),
        category: values.category,
        hsn: values.hsn.trim(),
        barcode: cleanCode(values.barcode, 32),
        rack: cleanCode(values.rack, 16),
        unit: values.unit,
        unitsPerStrip: Number(values.unitsPerStrip) || 1,
        allowLoose:
          values.unit === "STP" || values.unit === "LSE"
            ? values.allowLoose
            : false,
        mrp: Number(values.mrp) || 0,
        salePrice: Number(values.salePrice) || 0,
        minStock: Number(values.minStock) || 0,
        status: values.status,
      };

      setItems((prev) => {
        if (editId) {
          return prev.map((m) => (m.id === editId ? { ...m, ...payload } : m));
        }
        const row: Medicine = {
          id: newId("med"),
          ...payload,
          stockStrip: 0,
          stockLoose: 0,
          nearestExpiry: null,
        };
        return [row, ...prev];
      });
      setDialogOpen(false);
      setEditing(null);
      toast.success(editId ? "Medicine updated" : "Medicine added");
    },
    [],
  );

  const handleImport = useCallback((rows: ImportRow[]) => {
    setItems((prev) => [
      ...rows.map((r) => ({
        ...r,
        id: newId("med"),
        stockStrip: 0,
        stockLoose: 0,
        nearestExpiry: null,
      })),
      ...prev,
    ]);
    toast.success(`${rows.length} medicine(s) imported`);
  }, []);

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
