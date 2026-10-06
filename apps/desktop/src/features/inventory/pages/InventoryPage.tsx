import {
  useCallback,
  useDeferredValue,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  CalendarClock,
  CalendarX,
  Package,
  PackageX,
  Warehouse,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { SearchInput } from "@/components/common/SearchInput";
import { KeyHints } from "@/components/common/KeyHints";
import { useHotkeys } from "@/hooks/useHotkeys";
import { useListNavigation } from "@/hooks/useListNavigation";
import { oneOf, useUrlIntent } from "@/hooks/useUrlIntent";
import { KEYS } from "@/app/shortcuts/registry";
import { BatchHistoryDialog } from "../components/BatchHistoryDialog";
import {
  FilterChips,
  type FilterChipOption,
} from "@/components/common/FilterChips";
import { canSellLoose } from "@/features/medicines/types";
import { useInventoryStore } from "../store/useInventoryStore";
import { useInventoryRows } from "../hooks/useInventoryRows";
import { StockError } from "../utils/ledger";
import type {
  InventoryBatch,
  InventoryStatusFilter,
  StockAdjustValues,
} from "../types";
import { InventoryTable } from "../components/InventoryTable";
import { StockAdjustDialog } from "../components/StockAdjustDialog";
import { inventoryMatchesQuery } from "../utils/search";
import { batchStatuses, type BatchStatus } from "../utils/stock";
import { useSettingsStore } from "@/features/settings/store/useSettingsStore";

/** One filter predicate per status — shared by counts and filtering */
/** Filter chip → the ONE status it shows (chips never overlap) */
const FILTER_STATUS: Record<
  Exclude<InventoryStatusFilter, "all">,
  BatchStatus
> = {
  in_stock: "ok",
  low: "low",
  out: "out",
  expiring: "expiring",
  expired: "expired",
};

export default function InventoryPage() {
  // Batches joined with the medicine master (single source of truth)
  const items = useInventoryRows();
  const adjustStock = useInventoryStore((s) => s.adjust);
  // Dashboard links like /inventory?status=low&q=dolo
  const intent = useUrlIntent();
  const [query, setQuery] = useState(intent.q?.slice(0, 80) ?? "");
  const [statusFilter, setStatusFilter] = useState<InventoryStatusFilter>(
    oneOf(
      intent.status,
      ["all", "in_stock", "low", "out", "expiring", "expired"] as const,
      "all",
    ),
  );
  const [adjustTarget, setAdjustTarget] = useState<InventoryBatch | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Filtering runs at lower priority so typing stays smooth on big lists
  const deferredQuery = useDeferredValue(query);

  // One status per batch — the same map drives chips, counts and row badges
  const expiringDays = useSettingsStore((st) => st.inventory.expiringSoonDays);
  const statuses = useMemo(
    () => batchStatuses(items, new Date(), expiringDays),
    [items, expiringDays],
  );

  const stats = useMemo(() => {
    const counts: Record<BatchStatus, number> = {
      ok: 0,
      low: 0,
      out: 0,
      expiring: 0,
      expired: 0,
    };
    for (const st of statuses.values()) counts[st]++;
    return { batches: items.length, ...counts };
  }, [items, statuses]);

  const filtered = useMemo(() => {
    const want = statusFilter === "all" ? null : FILTER_STATUS[statusFilter];
    return items.filter(
      (b) =>
        (!want || statuses.get(b.id) === want) &&
        inventoryMatchesQuery(b, deferredQuery),
    );
  }, [items, deferredQuery, statusFilter, statuses]);

  // Keyboard: ↑↓ select · Enter adjust · H history · / search
  const nav = useListNavigation({
    items: filtered,
    getKey: (b: InventoryBatch) => b.id,
    onOpen: setAdjustTarget,
  });
  useHotkeys([
    { keys: KEYS.focusSearch, handler: () => searchRef.current?.select() },
    {
      keys: KEYS.history,
      enabled: nav.selected !== null,
      handler: () => nav.selected && setHistoryId(nav.selected.id),
    },
    {
      keys: KEYS.edit,
      enabled: nav.selected !== null,
      handler: () => nav.selected && setAdjustTarget(nav.selected),
    },
  ]);
  const openHistory = useCallback(
    (b: InventoryBatch) => setHistoryId(b.id),
    [],
  );

  const filterOptions = useMemo<FilterChipOption<InventoryStatusFilter>[]>(
    () => [
      { id: "all", label: "All", count: stats.batches },
      { id: "in_stock", label: "In stock", count: stats.ok },
      { id: "low", label: "Low", count: stats.low },
      { id: "out", label: "Out", count: stats.out },
      { id: "expiring", label: "Expiring", count: stats.expiring },
      { id: "expired", label: "Expired", count: stats.expired },
    ],
    [stats],
  );

  const closeAdjust = useCallback(() => setAdjustTarget(null), []);

  const handleAdjustSave = useCallback(
    (id: string, values: StockAdjustValues) => {
      const target = items.find((b) => b.id === id);
      const looseOk = target
        ? canSellLoose(target.unit, target.allowLoose)
        : false;
      try {
        const changed = adjustStock(
          id,
          {
            qtyStrip: Number(values.qtyStrip) || 0,
            qtyLoose: looseOk ? Number(values.qtyLoose) || 0 : 0,
          },
          values.reason,
        );
        setAdjustTarget(null);
        if (changed) toast.success(`Stock updated (${values.reason})`);
        else toast.info("No change in quantity");
      } catch (err) {
        toast.error(
          err instanceof StockError ? err.message : "Could not update stock",
        );
      }
    },
    [items, adjustStock],
  );

  return (
    <div className="h-full w-full p-3 overflow-hidden box-border bg-background flex flex-col gap-2.5 min-h-0">
      <PageHeader
        icon={Warehouse}
        title="Inventory"
        subtitle="Batch-wise stock · expiry · rack"
      />

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 shrink-0">
        <StatCard
          icon={Package}
          label="Batches"
          value={String(stats.batches)}
          iconClass="bg-primary/10 text-primary"
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
        <StatCard
          icon={CalendarClock}
          label="Expiring soon"
          value={String(stats.expiring)}
          iconClass="bg-amber-500/10 text-amber-600"
        />
        <StatCard
          icon={CalendarX}
          label="Expired"
          value={String(stats.expired)}
          iconClass="bg-red-500/10 text-red-600"
        />
      </div>

      <div className="flex items-center gap-2 shrink-0 min-w-0">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search medicine, batch, rack, brand..."
          inputRef={searchRef}
        />
        <FilterChips
          options={filterOptions}
          value={statusFilter}
          onChange={setStatusFilter}
          ariaLabel="Filter by stock status"
        />
      </div>

      <div className="flex items-center justify-between gap-3 shrink-0">
        <p className="text-[10px] text-muted-foreground">
          Showing {filtered.length} of {items.length} batches
        </p>
        <KeyHints
          hints={[
            { keys: "/", label: "Search" },
            { keys: ["ArrowUp", "ArrowDown"], label: "Move" },
            { keys: "Enter", label: "Adjust" },
            { keys: "H", label: "History" },
          ]}
        />
      </div>

      <InventoryTable
        items={filtered}
        statuses={statuses}
        onAdjust={setAdjustTarget}
        onHistory={openHistory}
        selectedId={nav.selectedKey}
        onSelect={nav.select}
      />

      <BatchHistoryDialog
        batchId={historyId}
        onClose={() => setHistoryId(null)}
      />

      <StockAdjustDialog
        open={Boolean(adjustTarget)}
        batch={adjustTarget}
        onClose={closeAdjust}
        onSave={handleAdjustSave}
      />
    </div>
  );
}
