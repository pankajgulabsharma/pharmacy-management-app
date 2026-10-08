import { useCan } from "@/features/auth/store/useAuthStore";
import {
  useCallback,
  useDeferredValue,
  useMemo,
  useRef,
  useState,
} from "react";
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
import { KeyHints } from "@/components/common/KeyHints";
import { useHotkeys } from "@/hooks/useHotkeys";
import { useListNavigation } from "@/hooks/useListNavigation";
import { oneOf, useUrlIntent } from "@/hooks/useUrlIntent";
import { KEYS } from "@/app/shortcuts/registry";
import { useInventoryStore } from "@/features/inventory/store/useInventoryStore";
import { tr } from "@/lib/i18n";
import { stockLevel } from "@medicare/domain/medicines/stockLevel";
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
} from "@medicare/domain/medicines/types";
import { CATEGORY_LABELS } from "@medicare/domain/medicines/types";
import { useMedicineStore } from "../store/useMedicineStore";
import { useMedicinesWithStock } from "../hooks/useMedicinesWithStock";
import { MedicineTable } from "../components/MedicineTable";
import { MedicineFormDialog } from "../components/MedicineFormDialog";
import { MedicineImportDialog } from "../components/MedicineImportDialog";
import type { ImportRow } from "@medicare/domain/medicines/csv";
import { BarcodeLabelDialog } from "../components/BarcodeLabelDialog";
import { MedicineDeleteDialog } from "../components/MedicineDeleteDialog";
import { medicineMatchesQuery } from "@medicare/domain/medicines/search";

/** Chips — exclusive, they add up to All (active medicines by stockLevel) */
type StatusFilter = "all" | "in_stock" | "low_only" | "out" | "inactive";

/** Which exclusive bucket a medicine is in */
function bucket(
  m: MedicineWithStock,
): "in_stock" | "low_only" | "out" | "inactive" {
  if (m.status !== "active") return "inactive";
  const level = stockLevel(m);
  return level === "out" ? "out" : level === "low" ? "low_only" : "in_stock";
}
type CategoryFilter = "all" | MedicineCategory;

const CATEGORY_OPTIONS: { value: CategoryFilter; label: string }[] = [
  { value: "all", label: "All categories" },
  ...(Object.keys(CATEGORY_LABELS) as MedicineCategory[]).map((key) => ({
    value: key,
    label: CATEGORY_LABELS[key],
  })),
];

/** Same rule as everywhere else (sellable stock only) — see stockLevel() */
function isOut(m: MedicineWithStock) {
  return stockLevel(m) === "out";
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
    schedule: v.schedule,
    status: v.status,
  };
}

/** The server's own message ("Name is required", "still has stock"…) */
function saveError(err: unknown): string {
  return err instanceof Error ? tr(err.message) : tr("Could not save");
}

export default function MedicinesPage() {
  // Master data + live stock from inventory (single source of truth)
  const items = useMedicinesWithStock();
  const addMedicine = useMedicineStore((s) => s.addMedicine);
  const savingRef = useRef(false);
  const updateMedicine = useMedicineStore((s) => s.updateMedicine);
  const removeMedicine = useMedicineStore((s) => s.removeMedicine);
  const importMedicines = useMedicineStore((s) => s.importMedicines);

  // Dashboard links like /medicines?q=dolo or /medicines?new=1
  const intent = useUrlIntent();
  const [query, setQuery] = useState(intent.q?.slice(0, 80) ?? "");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    oneOf(
      // Old links used "low" for Low / Out — they now open "Low"
      intent.status === "low" ? "low_only" : intent.status,
      ["all", "in_stock", "low_only", "out", "inactive"] as const,
      "all",
    ),
  );
  const searchRef = useRef<HTMLInputElement>(null);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [dialogOpen, setDialogOpen] = useState(intent.new === "1");
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<MedicineWithStock | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MedicineWithStock | null>(
    null,
  );

  // Filtering runs at lower priority so typing stays smooth on big lists
  const deferredQuery = useDeferredValue(query);

  const stats = useMemo(() => {
    const c = { in_stock: 0, low_only: 0, out: 0, inactive: 0 };
    for (const m of items) c[bucket(m)]++;
    return {
      total: items.length,
      active: items.length - c.inactive,
      ...c,
    };
  }, [items]);

  // Batch numbers per medicine, so typing a batch (e.g. OT3981M) finds it
  const batches = useInventoryStore((s) => s.batches);
  const batchText = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of batches)
      map.set(b.medicineId, `${map.get(b.medicineId) ?? ""} ${b.batchNo}`);
    return map;
  }, [batches]);

  const filtered = useMemo(
    () =>
      items.filter((m) => {
        if (statusFilter !== "all" && bucket(m) !== statusFilter) return false;
        if (categoryFilter !== "all" && m.category !== categoryFilter)
          return false;
        const q = deferredQuery.trim().toUpperCase();
        return (
          medicineMatchesQuery(m, deferredQuery) ||
          (q.length >= 3 && (batchText.get(m.id) ?? "").includes(q))
        );
      }),
    [items, deferredQuery, statusFilter, categoryFilter, batchText],
  );

  const filterOptions = useMemo<FilterChipOption<StatusFilter>[]>(
    () => [
      { id: "all", label: "All", count: stats.total },
      { id: "in_stock", label: "In stock", count: stats.in_stock },
      { id: "low_only", label: "Low", count: stats.low_only },
      { id: "out", label: "Out", count: stats.out },
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
  const [labelsFor, setLabelsFor] = useState<string | null>(null);
  const openLabels = useCallback(
    (m: MedicineWithStock) => setLabelsFor(m.id),
    [],
  );
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
      void (async () => {
        try {
          await removeMedicine(id);
          setDeleteTarget(null);
          toast.success(
            target ? `"${target.name}" deleted` : "Medicine deleted",
          );
        } catch (err) {
          toast.error(saveError(err));
        }
      })();
    },
    [items, removeMedicine],
  );

  const handleSave = useCallback(
    (values: MedicineFormValues, editId: string | null) => {
      if (savingRef.current) return; // ignore a double Enter / double click
      savingRef.current = true;
      void (async () => {
        try {
          const input = formToInput(values);
          if (editId) await updateMedicine(editId, input);
          else await addMedicine(input);
          // Close only after the database has saved it
          setDialogOpen(false);
          setEditing(null);
          toast.success(editId ? "Medicine updated" : "Medicine added");
        } catch (err) {
          toast.error(saveError(err)); // dialog stays open — nothing typed is lost
        } finally {
          savingRef.current = false;
        }
      })();
    },
    [addMedicine, updateMedicine],
  );

  const handleImport = useCallback(
    (rows: ImportRow[]) => {
      void (async () => {
        try {
          const r = await importMedicines(rows);
          toast.success(
            tr(
              "Imported: {{created}} new medicines, {{batches}} stock batches",
              {
                created: r.created,
                batches: r.batches,
              },
            ),
            r.existing
              ? {
                  description: tr(
                    "{{n}} were already in the list (not duplicated)",
                    {
                      n: r.existing,
                    },
                  ),
                }
              : undefined,
          );
        } catch (err) {
          toast.error(saveError(err));
        }
      })();
    },
    [importMedicines],
  );

  // Keyboard: ↑↓ select · Enter/E edit · N new · Delete · / search
  // Cashiers see the list; changing it is for pharmacist / owner
  const canEdit = useCan("stock");
  const nav = useListNavigation({
    items: filtered,
    getKey: (m: MedicineWithStock) => m.id,
    onOpen: canEdit ? openEdit : () => {},
  });
  useHotkeys([
    { keys: KEYS.focusSearch, handler: () => searchRef.current?.select() },
    { keys: KEYS.create, enabled: canEdit, handler: openAdd },
    {
      keys: KEYS.edit,
      enabled: canEdit && nav.selected !== null,
      handler: () => nav.selected && openEdit(nav.selected),
    },
    {
      keys: KEYS.remove,
      enabled: canEdit && nav.selected !== null,
      handler: () => nav.selected && setDeleteTarget(nav.selected),
    },
  ]);

  return (
    <div className="h-full w-full p-3 overflow-hidden box-border bg-background flex flex-col gap-2.5 min-h-0">
      <PageHeader
        icon={Pill}
        title="Medicines"
        subtitle="Master list · category, pack, price & stock"
        actions={
          canEdit ? (
            <>
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-lg text-[12px] gap-1.5"
                onClick={openImport}
              >
                <Upload className="h-3.5 w-3.5" />
                Import
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
          ) : null
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
          value={String(stats.low_only)}
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
          placeholder="Search name, salt, brand, batch no..."
          inputRef={searchRef}
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

      <div className="flex items-center justify-between gap-3 shrink-0">
        <p className="text-[10px] text-muted-foreground">
          Showing {filtered.length} of {items.length}
        </p>
        <KeyHints
          hints={[
            { keys: "/", label: "Search" },
            { keys: ["ArrowUp", "ArrowDown"], label: "Move" },
            ...(canEdit
              ? [
                  { keys: "Enter", label: "Edit" },
                  { keys: "N", label: "New" },
                  { keys: "Delete", label: "Delete" },
                ]
              : []),
          ]}
        />
      </div>

      <MedicineTable
        items={filtered}
        onEdit={canEdit ? openEdit : undefined}
        onDelete={canEdit ? setDeleteTarget : undefined}
        onLabels={openLabels}
        selectedId={nav.selectedKey}
        onSelect={nav.select}
      />

      <MedicineFormDialog
        open={dialogOpen}
        medicine={editing}
        onClose={closeForm}
        onSave={handleSave}
      />

      <BarcodeLabelDialog
        medicineId={labelsFor}
        onClose={() => setLabelsFor(null)}
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
