import { useCallback, useDeferredValue, useMemo, useState } from "react";
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
import {
  isExpired,
  isExpiringSoon,
  isLowStock,
  isOutOfStock,
} from "../utils/stock";

/** One filter predicate per status — shared by counts and filtering */
const MATCHERS: Record<
  Exclude<InventoryStatusFilter, "all">,
  (b: InventoryBatch) => boolean
> = {
  in_stock: (b) => !isOutOfStock(b) && !isExpired(b.expiry),
  low: (b) => isLowStock(b),
  out: (b) => isOutOfStock(b),
  expiring: (b) => isExpiringSoon(b.expiry) && !isExpired(b.expiry),
  expired: (b) => isExpired(b.expiry),
};

export default function InventoryPage() {
  // Batches joined with the medicine master (single source of truth)
  const items = useInventoryRows();
  const adjustStock = useInventoryStore((s) => s.adjust);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<InventoryStatusFilter>("all");
  const [adjustTarget, setAdjustTarget] = useState<InventoryBatch | null>(null);

  // Filtering runs at lower priority so typing stays smooth on big lists
  const deferredQuery = useDeferredValue(query);

  const stats = useMemo(() => {
    const counts = {
      in_stock: 0,
      low: 0,
      lowOnly: 0,
      out: 0,
      expiring: 0,
      expired: 0,
    };
    for (const b of items) {
      if (MATCHERS.in_stock(b)) counts.in_stock++;
      if (MATCHERS.low(b)) counts.low++;
      if (MATCHERS.low(b) && !isOutOfStock(b)) counts.lowOnly++;
      if (MATCHERS.out(b)) counts.out++;
      if (MATCHERS.expiring(b)) counts.expiring++;
      if (MATCHERS.expired(b)) counts.expired++;
    }
    return { batches: items.length, ...counts };
  }, [items]);

  const filtered = useMemo(() => {
    const match = statusFilter === "all" ? null : MATCHERS[statusFilter];
    return items.filter(
      (b) => (!match || match(b)) && inventoryMatchesQuery(b, deferredQuery),
    );
  }, [items, deferredQuery, statusFilter]);

  const filterOptions = useMemo<FilterChipOption<InventoryStatusFilter>[]>(
    () => [
      { id: "all", label: "All", count: stats.batches },
      { id: "in_stock", label: "In stock", count: stats.in_stock },
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
          value={String(stats.lowOnly)}
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
        />
        <FilterChips
          options={filterOptions}
          value={statusFilter}
          onChange={setStatusFilter}
          ariaLabel="Filter by stock status"
        />
      </div>

      <p className="text-[10px] text-muted-foreground shrink-0">
        Showing {filtered.length} of {items.length} batches
      </p>

      <InventoryTable items={filtered} onAdjust={setAdjustTarget} />

      <StockAdjustDialog
        open={Boolean(adjustTarget)}
        batch={adjustTarget}
        onClose={closeAdjust}
        onSave={handleAdjustSave}
      />
    </div>
  );
}
