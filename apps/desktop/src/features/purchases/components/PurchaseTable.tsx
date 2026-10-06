import { memo, useMemo, useEffect } from "react";
import { Eye, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { CodeChip } from "@/components/common/CodeChip";
import { RowActionButton } from "@/components/common/RowActionButton";
import {
  SpacerRow,
  TableShell,
  type TableColumn,
} from "@/components/common/TableShell";
import { useVirtualRows } from "@/hooks/useVirtualRows";
import { useStableCallback } from "@/hooks/useStableCallback";
import { SELECTED_ROW } from "@/hooks/useListNavigation";
import { formatISODate } from "@medicare/domain/lib/date";
import { formatPaise } from "@medicare/domain/lib/money";
import {
  PAYMENT_STATUS_META,
  type PaymentStatus,
  type Purchase,
} from "@medicare/domain/purchases/types";
import { getDuePaise } from "@medicare/domain/purchases/calc";

type Props = {
  items: Purchase[];
  statusById: ReadonlyMap<string, PaymentStatus>;
  onView: (p: Purchase) => void;
  /** Keyboard / click selection */
  selectedId?: string | null;
  onSelect?: (x: Purchase) => void;
};

const COLUMNS: TableColumn[] = [
  { key: "invoice", label: "Invoice", width: "w-[160px]" },
  { key: "supplier", label: "Supplier" },
  { key: "date", label: "Date", width: "w-[112px]" },
  { key: "items", label: "Items", width: "w-[88px]" },
  {
    key: "taxable",
    label: "Taxable (₹)",
    width: "w-[104px]",
    align: "text-right",
  },
  { key: "gst", label: "GST (₹)", width: "w-[92px]", align: "text-right" },
  { key: "total", label: "Total (₹)", width: "w-[108px]", align: "text-right" },
  { key: "due", label: "Balance (₹)", width: "w-[116px]", align: "text-right" },
  { key: "status", label: "Status", width: "w-[120px]" },
  { key: "actions", label: "", width: "w-[52px]", align: "text-center" },
];

/* Formatted strings per purchase — built once per (immutable) object */
type RowView = {
  date: string;
  dueDate: string;
  taxable: string;
  gst: string;
  total: string;
  duePaise: number;
  due: string;
};

const viewCache = new WeakMap<Purchase, RowView>();

function getRowView(p: Purchase): RowView {
  let v = viewCache.get(p);
  if (!v) {
    const duePaise = getDuePaise(p);
    v = {
      date: formatISODate(p.invoiceDate),
      dueDate: formatISODate(p.dueDate),
      taxable: formatPaise(p.totals.taxablePaise),
      gst: formatPaise(p.totals.gstPaise),
      total: formatPaise(p.totals.netPaise),
      duePaise,
      due: formatPaise(duePaise),
    };
    viewCache.set(p, v);
  }
  return v;
}

const getKey = (p: Purchase) => p.id;

export function PurchaseTable({
  items,
  statusById,
  onView,
  selectedId = null,
  onSelect,
}: Props) {
  // Stable callback so memoized rows don't re-render on parent renders
  const handleView = useStableCallback(onView);

  const rows = useMemo(() => items.map(getRowView), [items]);

  const {
    scrollRef,
    virtualRows,
    paddingTop,
    paddingBottom,
    measureElement,
    scrollToIndex,
  } = useVirtualRows({ items, getKey });
  const handleSelect = useStableCallback((x: Purchase) => onSelect?.(x));
  const scrollTo = useStableCallback(scrollToIndex);

  // Keep the keyboard-selected row on screen
  useEffect(() => {
    if (!selectedId) return;
    const i = items.findIndex((x) => x.id === selectedId);
    if (i >= 0) scrollTo(i);
  }, [selectedId, items, scrollTo]);

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Truck}
        title="No purchases found"
        description="Try changing the search or status filter, or add a new purchase."
      />
    );
  }

  return (
    <TableShell columns={COLUMNS} scrollRef={scrollRef}>
      <SpacerRow height={paddingTop} colSpan={COLUMNS.length} />

      {virtualRows.map((vr) => {
        const p = items[vr.index];
        return (
          <PurchaseRow
            key={vr.key}
            index={vr.index}
            purchase={p}
            view={rows[vr.index]}
            status={statusById.get(p.id) ?? "due"}
            measureRef={measureElement}
            selected={p.id === selectedId}
            onSelect={handleSelect}
            onView={handleView}
          />
        );
      })}

      <SpacerRow height={paddingBottom} colSpan={COLUMNS.length} />
    </TableShell>
  );
}

type RowProps = {
  index: number;
  purchase: Purchase;
  view: RowView;
  status: PaymentStatus;
  measureRef: (el: Element | null) => void;
  onView: (p: Purchase) => void;
  selected: boolean;
  onSelect: (x: Purchase) => void;
};

const PurchaseRow = memo(function PurchaseRow({
  index,
  purchase: p,
  view,
  status,
  measureRef,
  onView,
  selected,
  onSelect,
}: RowProps) {
  const meta = PAYMENT_STATUS_META[status];

  return (
    <tr
      onClick={() => onSelect(p)}
      aria-selected={selected}
      ref={measureRef}
      data-index={index}
      onDoubleClick={() => onView(p)}
      className={cn(
        "border-b border-border/60 last:border-0 hover:bg-muted/40",
        index % 2 === 1 && "bg-muted/20",
        selected && SELECTED_ROW,
        p.status === "cancelled" && "opacity-60",
      )}
    >
      <td className="px-3 py-2.5 align-middle">
        <CodeChip title={p.invoiceNo}>{p.invoiceNo}</CodeChip>
        {p.notes ? (
          <p
            className="text-[10px] text-muted-foreground mt-0.5 truncate"
            title={p.notes}
          >
            {p.notes}
          </p>
        ) : null}
      </td>

      <td className="px-3 py-2.5 align-middle">
        <p
          className="font-medium text-foreground leading-tight truncate"
          title={p.supplierName}
        >
          {p.supplierName}
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5 font-mono truncate">
          {p.supplierGstin}
        </p>
      </td>

      <td className="px-3 py-2.5 align-middle whitespace-nowrap tabular-nums">
        {view.date}
      </td>

      <td className="px-3 py-2.5 align-middle whitespace-nowrap">
        <p className="text-foreground">{p.totals.lineCount} items</p>
        <p className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
          {p.totals.totalQty}
          {p.totals.totalFreeQty > 0 ? ` + ${p.totals.totalFreeQty} free` : ""}
        </p>
      </td>

      <td className="px-3 py-2.5 align-middle text-right tabular-nums text-muted-foreground">
        {view.taxable}
      </td>

      <td className="px-3 py-2.5 align-middle text-right tabular-nums text-muted-foreground">
        {view.gst}
      </td>

      <td className="px-3 py-2.5 align-middle text-right tabular-nums font-semibold text-foreground">
        {view.total}
      </td>

      <td className="px-3 py-2.5 align-middle text-right">
        <p
          className={cn(
            "font-semibold tabular-nums",
            view.duePaise === 0
              ? "text-muted-foreground"
              : status === "overdue"
                ? "text-red-600 dark:text-red-400"
                : "text-orange-600 dark:text-orange-400",
          )}
        >
          {view.due}
        </p>
        {view.duePaise > 0 ? (
          <p className="text-[10px] text-muted-foreground mt-0.5 whitespace-nowrap">
            Due {view.dueDate}
          </p>
        ) : null}
      </td>

      <td className="px-3 py-2.5 align-middle">
        <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
      </td>

      <td className="px-2 py-2.5 align-middle text-center">
        <RowActionButton
          icon={Eye}
          label={`View purchase ${p.invoiceNo}`}
          title="View details"
          onClick={() => onView(p)}
        />
      </td>
    </tr>
  );
});
