import { memo, useMemo, useEffect } from "react";
import { History, PackageSearch, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge, type BadgeTone } from "@/components/common/StatusBadge";
import { CodeChip } from "@/components/common/CodeChip";
import { ExpiryText } from "@/components/common/ExpiryText";
import { RowActionButton } from "@/components/common/RowActionButton";
import {
  SpacerRow,
  TableShell,
  type TableColumn,
} from "@/components/common/TableShell";
import { useVirtualRows } from "@/hooks/useVirtualRows";
import { useStableCallback } from "@/hooks/useStableCallback";
import { SELECTED_ROW } from "@/hooks/useListNavigation";
import { formatRupees, inrFromPaise } from "@medicare/domain/lib/money";
import { getExpiringSoonDays } from "@/features/settings/store/useSettingsStore";
import type { InventoryBatch } from "@medicare/domain/inventory/types";
import {
  CATEGORY_LABELS,
  canSellLoose,
  formatPackLabel,
} from "@medicare/domain/medicines/types";
import { batchCostPaise, type BatchStatus } from "../utils/stock";

type Props = {
  items: InventoryBatch[];
  /** One status per batch, from batchStatuses() */
  statuses: ReadonlyMap<string, BatchStatus>;
  /** Left out when your role can't adjust stock — no adjust button */
  onAdjust?: (b: InventoryBatch) => void;
  /** Open the batch's stock history */
  onHistory: (b: InventoryBatch) => void;
  /** Keyboard / click selection */
  selectedId?: string | null;
  onSelect?: (i: InventoryBatch) => void;
};

/* ------------------------------------------------------------------ */
/* Static config — created once at module load, never per render      */
/* ------------------------------------------------------------------ */

type StatusKey = BatchStatus;

const STATUS: Record<
  StatusKey,
  { label: string; tone: BadgeTone; row: string }
> = {
  expired: {
    label: "Expired",
    tone: "danger",
    row: "bg-red-50/40 dark:bg-red-950/20",
  },
  out: { label: "Out of stock", tone: "danger", row: "" },
  low: { label: "Low stock", tone: "warning", row: "" },
  expiring: { label: "Expiring", tone: "caution", row: "" },
  ok: { label: "In stock", tone: "success", row: "" },
};

const COLUMNS: TableColumn[] = [
  { key: "medicine", label: "Medicine" },
  { key: "batch", label: "Batch", width: "w-[104px]" },
  { key: "pack", label: "Pack", width: "w-[112px]" },
  { key: "expiry", label: "Expiry", width: "w-[96px]" },
  { key: "rack", label: "Rack", width: "w-[88px]" },
  { key: "stock", label: "Stock", width: "w-[120px]" },
  { key: "mrp", label: "MRP (₹)", width: "w-[84px]", align: "text-right" },
  {
    key: "purchase",
    label: "Cost (₹)",
    width: "w-[84px]",
    align: "text-right",
  },
  { key: "sale", label: "Sale (₹)", width: "w-[92px]", align: "text-right" },
  { key: "status", label: "Status", width: "w-[112px]" },
  { key: "actions", label: "", width: "w-[80px]", align: "text-center" },
];

/** Stock colour follows the batch status: red out, orange low, green otherwise */
function stockTextClass(status: StatusKey): string {
  if (status === "out") return "text-red-500";
  if (status === "low") return "text-orange-600 dark:text-orange-400";
  return "text-emerald-600 dark:text-emerald-400";
}

/* ------------------------------------------------------------------ */
/* Derived row data — computed once per batch object and cached       */
/* ------------------------------------------------------------------ */

type RowView = {
  batch: InventoryBatch;
  status: StatusKey;
  expiring: boolean;
  looseOk: boolean;
  packLabel: string;
  subtitle: string;
  stockText: string;
  stockClass: string;
  /** Value at landed cost, paise (shared batchCostPaise) */
  stockValuePaise: number;
  margin: number;
  mrp: string;
  purchase: string;
  sale: string;
  /** Day the view was computed — expiry status changes with the date */
  day: string;
};

const rowCache = new WeakMap<InventoryBatch, RowView>();

function buildRowView(
  b: InventoryBatch,
  day: string,
  status: StatusKey,
): RowView {
  // Status comes from batchStatus() — the same one the filters use
  const expiring = status === "expiring";

  const looseOk = canSellLoose(b.unit, b.allowLoose);

  // LSE-only items show the loose count directly
  const stockText =
    b.unit === "LSE"
      ? `${b.qtyLoose} LSE`
      : `${b.qtyStrip} ${b.unit}${looseOk && b.qtyLoose > 0 ? ` + ${b.qtyLoose}` : ""}`;

  return {
    batch: b,
    status,
    expiring,
    looseOk,
    packLabel: formatPackLabel(b.unit, b.unitsPerStrip),
    // Salt shown so a same-salt match (Dolo 650 for "paracetamol") is clear
    subtitle: [b.salt, b.brand, CATEGORY_LABELS[b.category]]
      .filter(Boolean)
      .join(" · "),
    stockText,
    stockClass: stockTextClass(status),
    stockValuePaise: batchCostPaise(b, b),
    margin:
      b.salePrice > 0
        ? ((b.salePrice - b.purchasePrice) / b.salePrice) * 100
        : 0,
    mrp: formatRupees(b.mrp),
    purchase: formatRupees(b.purchasePrice),
    sale: formatRupees(b.salePrice),
    day,
  };
}

/**
 * Returns the cached view while the batch object is unchanged (immutable
 * updates create a new object, which invalidates the cache automatically).
 */
function getRowView(
  b: InventoryBatch,
  day: string,
  status: StatusKey,
): RowView {
  const cached = rowCache.get(b);
  // Low stock depends on the medicine's OTHER batches too, so status is part of the key
  if (cached && cached.day === day && cached.status === status) return cached;
  const view = buildRowView(b, day, status);
  rowCache.set(b, view);
  return view;
}

const getKey = (b: InventoryBatch) => b.id;

/* ------------------------------------------------------------------ */
/* Table                                                              */
/* ------------------------------------------------------------------ */

export function InventoryTable({
  items,
  statuses,
  onAdjust,
  onHistory,
  selectedId = null,
  onSelect,
}: Props) {
  const handleHistory = useStableCallback(onHistory);
  const handleAdjust = useStableCallback((b: InventoryBatch) => onAdjust?.(b));

  // Single pass: row views + footer totals
  const { rows, totalValue, attentionCount } = useMemo(() => {
    // Row status depends on the date AND the "expiring soon" setting
    const day = `${new Date().toDateString()}|${getExpiringSoonDays()}`;
    const views: RowView[] = [];
    let total = 0;
    let attention = 0;
    for (const b of items) {
      const v = getRowView(b, day, statuses.get(b.id) ?? "ok");
      views.push(v);
      total += v.stockValuePaise;
      if (v.status !== "ok") attention++;
    }
    return { rows: views, totalValue: total, attentionCount: attention };
  }, [items, statuses]);

  const {
    scrollRef,
    virtualRows,
    paddingTop,
    paddingBottom,
    measureElement,
    scrollToIndex,
  } = useVirtualRows({ items, getKey });
  const handleSelect = useStableCallback((x: InventoryBatch) => onSelect?.(x));

  const scrollTo = useStableCallback(scrollToIndex);

  // Keep the keyboard-selected row on screen
  useEffect(() => {
    if (!selectedId) return;
    const i = items.findIndex((x) => x.id === selectedId);
    if (i >= 0) scrollTo(i);
  }, [selectedId, items, scrollTo]);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={PackageSearch}
        title="No stock batches found"
        description="Try changing the search or filters"
      />
    );
  }

  return (
    <TableShell
      columns={COLUMNS}
      scrollRef={scrollRef}
      footer={
        <>
          <span>
            <span className="font-semibold text-foreground">{rows.length}</span>{" "}
            batches
            {attentionCount > 0 && (
              <>
                {" · "}
                <span className="font-semibold text-orange-600 dark:text-orange-400">
                  {attentionCount}
                </span>{" "}
                need attention
              </>
            )}
          </span>
          <span>
            Stock value (at cost):{" "}
            <span className="font-semibold text-foreground tabular-nums">
              {inrFromPaise(totalValue)}
            </span>
          </span>
        </>
      }
    >
      <SpacerRow height={paddingTop} colSpan={COLUMNS.length} />

      {virtualRows.map((vr) => (
        <InventoryRow
          key={vr.key}
          view={rows[vr.index]}
          index={vr.index}
          measureRef={measureElement}
          selected={rows[vr.index].batch.id === selectedId}
          onSelect={handleSelect}
          onAdjust={onAdjust ? handleAdjust : undefined}
          onHistory={handleHistory}
        />
      ))}

      <SpacerRow height={paddingBottom} colSpan={COLUMNS.length} />
    </TableShell>
  );
}

/* ------------------------------------------------------------------ */
/* Row — memoized; re-renders only when its own batch changes         */
/* ------------------------------------------------------------------ */

type RowProps = {
  view: RowView;
  index: number;
  measureRef: (el: Element | null) => void;
  /** Left out when your role can't adjust stock — no adjust button */
  onAdjust?: (b: InventoryBatch) => void;
  onHistory: (b: InventoryBatch) => void;
  selected: boolean;
  onSelect: (x: InventoryBatch) => void;
};

const InventoryRow = memo(function InventoryRow({
  view,
  index,
  measureRef,
  onAdjust,
  onHistory,
  selected,
  onSelect,
}: RowProps) {
  const { batch: b, status: statusKey, expiring } = view;
  const status = STATUS[statusKey];

  return (
    <tr
      onClick={() => onSelect(b)}
      aria-selected={selected}
      ref={measureRef}
      data-index={index}
      className={cn(
        "border-b border-border/60 last:border-0 hover:bg-muted/40",
        index % 2 === 1 && "bg-muted/20",
        selected && SELECTED_ROW,
        status.row,
      )}
    >
      {/* Medicine */}
      <td className="px-3 py-2.5 align-middle">
        <p
          className="font-medium text-foreground leading-tight truncate"
          title={b.medicineName}
        >
          {b.medicineName}
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
          {view.subtitle}
        </p>
      </td>

      {/* Batch */}
      <td className="px-3 py-2.5 align-middle">
        <CodeChip>{b.batchNo}</CodeChip>
      </td>

      {/* Pack */}
      <td className="px-3 py-2.5 align-middle">
        <p className="text-foreground whitespace-nowrap">{view.packLabel}</p>
        {view.looseOk && (
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Loose allowed
          </p>
        )}
      </td>

      {/* Expiry */}
      <td className="px-3 py-2.5 align-middle">
        <ExpiryText
          value={b.expiry}
          state={
            statusKey === "expired" ? "expired" : expiring ? "expiring" : "ok"
          }
        />
      </td>

      {/* Rack */}
      <td className="px-3 py-2.5 align-middle">
        {b.rack ? (
          <CodeChip tone="primary">{b.rack}</CodeChip>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>

      {/* Stock */}
      <td className="px-3 py-2.5 align-middle whitespace-nowrap">
        <span className={cn("font-semibold tabular-nums", view.stockClass)}>
          {view.stockText}
        </span>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Min {b.minStock}
        </p>
      </td>

      {/* MRP */}
      <td className="px-3 py-2.5 align-middle text-right tabular-nums text-muted-foreground">
        {view.mrp}
      </td>

      {/* Purchase */}
      <td className="px-3 py-2.5 align-middle text-right tabular-nums text-muted-foreground">
        {view.purchase}
      </td>

      {/* Sale + margin */}
      <td className="px-3 py-2.5 align-middle text-right">
        <p className="font-semibold tabular-nums text-foreground">
          {view.sale}
        </p>
        <p
          className={cn(
            "mt-0.5 text-[10px] tabular-nums",
            view.margin > 0
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-red-500",
          )}
        >
          {view.margin > 0 ? "+" : ""}
          {view.margin.toFixed(1)}%
        </p>
      </td>

      {/* Status */}
      <td className="px-3 py-2.5 align-middle whitespace-nowrap">
        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
      </td>

      {/* Actions */}
      <td className="px-2 py-2.5 align-middle text-center">
        <div className="inline-flex items-center gap-0.5">
          <RowActionButton
            icon={History}
            label={`Stock history of ${b.medicineName} (${b.batchNo})`}
            title="Batch history (H)"
            onClick={() => onHistory(b)}
          />
          {onAdjust ? (
            <RowActionButton
              icon={SlidersHorizontal}
              label={`Adjust stock for ${b.medicineName} (${b.batchNo})`}
              title="Adjust stock (Enter)"
              onClick={() => onAdjust(b)}
            />
          ) : null}
        </div>
      </td>
    </tr>
  );
});
