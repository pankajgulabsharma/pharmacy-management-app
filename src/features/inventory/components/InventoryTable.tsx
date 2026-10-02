import { memo, useMemo } from "react";
import { PackageSearch, SlidersHorizontal } from "lucide-react";
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
import { formatRupees } from "@/lib/money";
import type { InventoryBatch } from "../types";
import {
  CATEGORY_LABELS,
  canSellLoose,
  formatPackLabel,
} from "@/features/medicines/types";
import {
  isExpired,
  isExpiringSoon,
  isLowStock,
  isOutOfStock,
} from "../utils/stock";

type Props = {
  items: InventoryBatch[];
  onAdjust: (b: InventoryBatch) => void;
};

/* ------------------------------------------------------------------ */
/* Static config — created once at module load, never per render      */
/* ------------------------------------------------------------------ */

type StatusKey = "expired" | "out" | "low" | "expiring" | "ok";

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
  { key: "actions", label: "", width: "w-[56px]", align: "text-center" },
];

/** Stock colour: red when out, orange when low, green otherwise */
function stockTextClass(b: InventoryBatch): string {
  if (isOutOfStock(b)) return "text-red-500";
  if (isLowStock(b)) return "text-orange-600 dark:text-orange-400";
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
  stockValue: number;
  margin: number;
  mrp: string;
  purchase: string;
  sale: string;
  /** Day the view was computed — expiry status changes with the date */
  day: string;
};

const rowCache = new WeakMap<InventoryBatch, RowView>();

function buildRowView(b: InventoryBatch, day: string): RowView {
  const expired = isExpired(b.expiry);
  const expiring = !expired && isExpiringSoon(b.expiry);

  let status: StatusKey = "ok";
  if (expired) status = "expired";
  else if (isOutOfStock(b)) status = "out";
  else if (isLowStock(b)) status = "low";
  else if (expiring) status = "expiring";

  const looseOk = canSellLoose(b.unit, b.allowLoose);
  const ups = b.unitsPerStrip > 0 ? b.unitsPerStrip : 1;

  // Stock in the same unit as minStock (packs, or loose units for LSE)
  const packs = b.unit === "LSE" ? b.qtyLoose : b.qtyStrip + b.qtyLoose / ups;

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
    subtitle: `${b.brand} · ${CATEGORY_LABELS[b.category]}`,
    stockText,
    stockClass: stockTextClass(b),
    stockValue: packs * b.purchasePrice,
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
function getRowView(b: InventoryBatch, day: string): RowView {
  const cached = rowCache.get(b);
  if (cached && cached.day === day) return cached;
  const view = buildRowView(b, day);
  rowCache.set(b, view);
  return view;
}

const getKey = (b: InventoryBatch) => b.id;

/* ------------------------------------------------------------------ */
/* Table                                                              */
/* ------------------------------------------------------------------ */

export function InventoryTable({ items, onAdjust }: Props) {
  const handleAdjust = useStableCallback(onAdjust);

  // Single pass: row views + footer totals
  const { rows, totalValue, attentionCount } = useMemo(() => {
    const day = new Date().toDateString();
    const views: RowView[] = [];
    let total = 0;
    let attention = 0;
    for (const b of items) {
      const v = getRowView(b, day);
      views.push(v);
      total += v.stockValue;
      if (v.status !== "ok") attention++;
    }
    return { rows: views, totalValue: total, attentionCount: attention };
  }, [items]);

  const { scrollRef, virtualRows, paddingTop, paddingBottom, measureElement } =
    useVirtualRows({ items, getKey });

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
              ₹{formatRupees(totalValue)}
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
          onAdjust={handleAdjust}
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
  onAdjust: (b: InventoryBatch) => void;
};

const InventoryRow = memo(function InventoryRow({
  view,
  index,
  measureRef,
  onAdjust,
}: RowProps) {
  const { batch: b, status: statusKey, expiring } = view;
  const status = STATUS[statusKey];

  return (
    <tr
      ref={measureRef}
      data-index={index}
      className={cn(
        "border-b border-border/60 last:border-0 hover:bg-muted/40",
        index % 2 === 1 && "bg-muted/20",
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
        <RowActionButton
          icon={SlidersHorizontal}
          label={`Adjust stock for ${b.medicineName} (${b.batchNo})`}
          title="Adjust stock"
          onClick={() => onAdjust(b)}
        />
      </td>
    </tr>
  );
});
