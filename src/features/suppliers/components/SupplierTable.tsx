import { memo, useEffect } from "react";
import { Eye, Pencil, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/common/EmptyState";
import { RowActionButton } from "@/components/common/RowActionButton";
import { StatusBadge } from "@/components/common/StatusBadge";
import {
  SUPPLIER_STATUS_LABEL,
  SUPPLIER_STATUS_TONE,
  supplierStatus,
} from "../utils/status";
import { CodeChip } from "@/components/common/CodeChip";
import {
  SpacerRow,
  TableShell,
  type TableColumn,
} from "@/components/common/TableShell";
import { useVirtualRows } from "@/hooks/useVirtualRows";
import { useStableCallback } from "@/hooks/useStableCallback";
import { SELECTED_ROW } from "@/hooks/useListNavigation";
import { formatISODate } from "@/lib/date";
import { formatPaise } from "@/lib/money";
import type { SupplierWithSummary } from "../types";

type Props = {
  items: SupplierWithSummary[];
  onView: (s: SupplierWithSummary) => void;
  onEdit: (s: SupplierWithSummary) => void;
  /** Keyboard / click selection */
  selectedId?: string | null;
  onSelect?: (x: SupplierWithSummary) => void;
};

/*
 * Percentage widths (sum = 100%) share the space between all columns.
 * Before, only "Supplier" had no width, so it swallowed all the spare
 * room and left a big gap after the name.
 */
/**
 * Widths fit their content; only "Supplier" has no width, so it takes all
 * remaining space (see TableShell). No gaps between short values.
 */
const COLUMNS: TableColumn[] = [
  { key: "supplier", label: "Supplier" },
  { key: "contact", label: "Contact", width: "w-[160px]" },
  { key: "terms", label: "Credit", width: "w-[76px]" },
  { key: "invoices", label: "Invoices", width: "w-[128px]" },
  {
    key: "purchased",
    label: "Purchased (₹)",
    width: "w-[124px]",
    align: "text-right",
  },
  {
    key: "outstanding",
    label: "Outstanding (₹)",
    width: "w-[136px]",
    align: "text-right",
  },
  { key: "status", label: "Status", width: "w-[92px]", align: "text-center" },
  { key: "actions", label: "", width: "w-[80px]", align: "text-center" },
];

const getKey = (s: SupplierWithSummary) => s.id;

export function SupplierTable({
  items,
  onView,
  onEdit,
  selectedId = null,
  onSelect,
}: Props) {
  const handleView = useStableCallback(onView);
  const handleEdit = useStableCallback(onEdit);
  const {
    scrollRef,
    virtualRows,
    paddingTop,
    paddingBottom,
    measureElement,
    scrollToIndex,
  } = useVirtualRows({ items, getKey });
  const handleSelect = useStableCallback((x: SupplierWithSummary) =>
    onSelect?.(x),
  );
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
        icon={Users}
        title="No suppliers found"
        description="Try changing the search or filter, or add a new supplier."
      />
    );
  }

  return (
    <TableShell
      columns={COLUMNS}
      scrollRef={scrollRef}
      minWidthClass="min-w-[1040px]"
    >
      <SpacerRow height={paddingTop} colSpan={COLUMNS.length} />
      {virtualRows.map((vr) => (
        <SupplierRow
          key={vr.key}
          index={vr.index}
          s={items[vr.index]}
          measureRef={measureElement}
          selected={items[vr.index].id === selectedId}
          onSelect={handleSelect}
          onView={handleView}
          onEdit={handleEdit}
        />
      ))}
      <SpacerRow height={paddingBottom} colSpan={COLUMNS.length} />
    </TableShell>
  );
}

const SupplierRow = memo(function SupplierRow({
  index,
  s,
  measureRef,
  onView,
  onEdit,
  selected,
  onSelect,
}: {
  index: number;
  s: SupplierWithSummary;
  measureRef: (el: Element | null) => void;
  onView: (s: SupplierWithSummary) => void;
  onEdit: (s: SupplierWithSummary) => void;
  selected: boolean;
  onSelect: (x: SupplierWithSummary) => void;
}) {
  return (
    <tr
      onClick={() => onSelect(s)}
      aria-selected={selected}
      ref={measureRef}
      data-index={index}
      onDoubleClick={() => onView(s)}
      className={cn(
        "border-b border-border/60 last:border-0 hover:bg-muted/40",
        index % 2 === 1 && "bg-muted/20",
        selected && SELECTED_ROW,
        s.status === "inactive" && "opacity-60",
      )}
    >
      <td className="px-3 py-2.5 align-middle">
        <p
          className="font-medium text-foreground leading-tight truncate"
          title={s.name}
        >
          {s.name}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 min-w-0">
          <CodeChip>{s.gstin}</CodeChip>
          <span className="text-[10px] text-muted-foreground truncate">
            {s.city}
          </span>
        </p>
      </td>

      <td className="px-3 py-2.5 align-middle">
        <p className="text-foreground truncate">{s.contactPerson || "—"}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
          {s.phone}
        </p>
      </td>

      <td className="px-3 py-2.5 align-middle whitespace-nowrap tabular-nums">
        {s.creditDays} days
      </td>

      <td className="px-3 py-2.5 align-middle whitespace-nowrap">
        <p className="text-foreground">
          {s.invoiceCount}
          {s.returnCount > 0 ? (
            <span className="text-muted-foreground">
              {" "}
              · {s.returnCount} ret.
            </span>
          ) : null}
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {s.lastPurchaseDate
            ? `Last ${formatISODate(s.lastPurchaseDate)}`
            : "No purchases"}
        </p>
      </td>

      <td className="px-3 py-2.5 align-middle text-right tabular-nums text-muted-foreground">
        {formatPaise(s.purchasedPaise)}
      </td>

      <td className="px-3 py-2.5 align-middle text-right">
        <p
          className={cn(
            "font-semibold tabular-nums",
            s.overduePaise > 0
              ? "text-red-600 dark:text-red-400"
              : s.outstandingPaise > 0
                ? "text-orange-600 dark:text-orange-400"
                : "text-muted-foreground",
          )}
        >
          {formatPaise(s.outstandingPaise)}
        </p>
        {s.overduePaise > 0 ? (
          <p className="text-[10px] text-red-500/80 mt-0.5 whitespace-nowrap">
            {formatPaise(s.overduePaise)} overdue
          </p>
        ) : s.creditPaise > 0 ? (
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 whitespace-nowrap">
            Credit {formatPaise(s.creditPaise)}
          </p>
        ) : null}
      </td>

      <td className="px-3 py-2.5 align-middle text-center">
        <StatusBadge tone={SUPPLIER_STATUS_TONE[supplierStatus(s)]}>
          {SUPPLIER_STATUS_LABEL[supplierStatus(s)]}
        </StatusBadge>
      </td>

      <td className="px-2 py-2.5 align-middle text-center">
        <div className="inline-flex items-center gap-1">
          <RowActionButton
            icon={Eye}
            label={`View ${s.name}`}
            title="View"
            onClick={() => onView(s)}
          />
          <RowActionButton
            icon={Pencil}
            label={`Edit ${s.name}`}
            title="Edit"
            onClick={() => onEdit(s)}
          />
        </div>
      </td>
    </tr>
  );
});
