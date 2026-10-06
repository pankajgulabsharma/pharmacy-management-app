import { memo, useEffect } from "react";
import { Eye, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CodeChip } from "@/components/common/CodeChip";
import { EmptyState } from "@/components/common/EmptyState";
import { RowActionButton } from "@/components/common/RowActionButton";
import { StatusBadge } from "@/components/common/StatusBadge";
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
import { RETURN_REASONS, type PurchaseReturn } from "../types";

type Props = {
  items: PurchaseReturn[];
  onView: (r: PurchaseReturn) => void;
  /** Keyboard / click selection */
  selectedId?: string | null;
  onSelect?: (x: PurchaseReturn) => void;
};

const COLUMNS: TableColumn[] = [
  { key: "no", label: "Debit note", width: "w-[112px]" },
  { key: "date", label: "Date", width: "w-[112px]" },
  { key: "supplier", label: "Supplier" },
  { key: "invoice", label: "Against invoice", width: "w-[150px]" },
  { key: "items", label: "Items", width: "w-[96px]" },
  { key: "reason", label: "Reason", width: "w-[150px]" },
  { key: "gst", label: "GST (₹)", width: "w-[88px]", align: "text-right" },
  {
    key: "amount",
    label: "Credit (₹)",
    width: "w-[108px]",
    align: "text-right",
  },
  { key: "actions", label: "", width: "w-[52px]", align: "text-center" },
];

const getKey = (r: PurchaseReturn) => r.id;

export function ReturnTable({
  items,
  onView,
  selectedId = null,
  onSelect,
}: Props) {
  const handleView = useStableCallback(onView);
  const {
    scrollRef,
    virtualRows,
    paddingTop,
    paddingBottom,
    measureElement,
    scrollToIndex,
  } = useVirtualRows({ items, getKey });
  const handleSelect = useStableCallback((x: PurchaseReturn) => onSelect?.(x));
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
        icon={Undo2}
        title="No purchase returns"
        description="Open an invoice and choose “Return to supplier” to create a debit note."
      />
    );
  }

  return (
    <TableShell
      columns={COLUMNS}
      scrollRef={scrollRef}
      minWidthClass="min-w-[1000px]"
    >
      <SpacerRow height={paddingTop} colSpan={COLUMNS.length} />
      {virtualRows.map((vr) => (
        <ReturnRow
          key={vr.key}
          index={vr.index}
          ret={items[vr.index]}
          measureRef={measureElement}
          selected={items[vr.index].id === selectedId}
          onSelect={handleSelect}
          onView={handleView}
        />
      ))}
      <SpacerRow height={paddingBottom} colSpan={COLUMNS.length} />
    </TableShell>
  );
}

const ReturnRow = memo(function ReturnRow({
  index,
  ret: r,
  measureRef,
  onView,
  selected,
  onSelect,
}: {
  index: number;
  ret: PurchaseReturn;
  measureRef: (el: Element | null) => void;
  onView: (r: PurchaseReturn) => void;
  selected: boolean;
  onSelect: (x: PurchaseReturn) => void;
}) {
  return (
    <tr
      onClick={() => onSelect(r)}
      aria-selected={selected}
      ref={measureRef}
      data-index={index}
      onDoubleClick={() => onView(r)}
      className={cn(
        "border-b border-border/60 last:border-0 hover:bg-muted/40",
        index % 2 === 1 && "bg-muted/20",
        selected && SELECTED_ROW,
      )}
    >
      <td className="px-3 py-2.5 align-middle">
        <CodeChip>{r.returnNo}</CodeChip>
      </td>
      <td className="px-3 py-2.5 align-middle whitespace-nowrap tabular-nums">
        {formatISODate(r.date)}
      </td>
      <td className="px-3 py-2.5 align-middle">
        <p
          className="font-medium text-foreground truncate"
          title={r.supplierName}
        >
          {r.supplierName}
        </p>
        {r.notes ? (
          <p
            className="text-[10px] text-muted-foreground mt-0.5 truncate"
            title={r.notes}
          >
            {r.notes}
          </p>
        ) : null}
      </td>
      <td className="px-3 py-2.5 align-middle">
        <CodeChip title={r.invoiceNo}>{r.invoiceNo}</CodeChip>
      </td>
      <td className="px-3 py-2.5 align-middle whitespace-nowrap">
        <p className="text-foreground">{r.lines.length} items</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {r.totalQty} packs
        </p>
      </td>
      <td className="px-3 py-2.5 align-middle">
        <StatusBadge
          tone={
            r.reason === "expired" || r.reason === "damaged"
              ? "danger"
              : "caution"
          }
        >
          {RETURN_REASONS[r.reason]}
        </StatusBadge>
      </td>
      <td className="px-3 py-2.5 align-middle text-right tabular-nums text-muted-foreground">
        {formatPaise(r.gstPaise)}
      </td>
      <td className="px-3 py-2.5 align-middle text-right tabular-nums font-semibold text-foreground">
        {formatPaise(r.totalPaise)}
      </td>
      <td className="px-2 py-2.5 align-middle text-center">
        <RowActionButton
          icon={Eye}
          label={`View debit note ${r.returnNo}`}
          title="View details"
          onClick={() => onView(r)}
        />
      </td>
    </tr>
  );
});
