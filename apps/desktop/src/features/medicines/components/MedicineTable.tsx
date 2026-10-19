import { ScheduleBadge } from "@/components/common/ScheduleBadge";
import { useEffect } from "react";
import {
  Barcode,
  Pencil as PencilIcon,
  PillBottle,
  Trash2,
} from "lucide-react";
import { SELECTED_ROW } from "@/hooks/useListNavigation";
import { stockLevel } from "@medicare/domain/medicines/stockLevel";
import { useVirtualRows } from "@/hooks/useVirtualRows";
import { SpacerRow, type TableColumn } from "@/components/common/TableShell";
import { cn } from "@/lib/utils";
import { tr } from "@/lib/i18n";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { CodeChip } from "@/components/common/CodeChip";
import { ExpiryText, type ExpiryState } from "@/components/common/ExpiryText";
import type { MedicineWithStock } from "@medicare/domain/medicines/types";
import {
  CATEGORY_LABELS,
  canSellLoose,
  formatPackLabel,
} from "@medicare/domain/medicines/types";
import { isExpired, isExpiringSoon } from "@/features/inventory/utils/stock";

type Props = {
  items: MedicineWithStock[];
  /** Left out when your role can't change medicines — no edit/delete buttons */
  onEdit?: (m: MedicineWithStock) => void;
  onDelete?: (m: MedicineWithStock) => void;
  /** Print barcode stickers (everyone) */
  onLabels?: (m: MedicineWithStock) => void;
  /** Keyboard / click selection */
  selectedId?: string | null;
  onSelect?: (m: MedicineWithStock) => void;
};

const getKey = (m: MedicineWithStock) => m.id;

/** Every column but the name has a fixed width — the name takes the rest */
const COLUMNS: readonly TableColumn[] = [
  { key: "name", label: "Medicine" },
  { key: "category", label: "Category", width: "w-[124px]" },
  { key: "brand", label: "Brand / HSN", width: "w-[112px]" },
  { key: "rack", label: "Rack", width: "w-[76px]" },
  { key: "pack", label: "Pack", width: "w-[96px]" },
  { key: "expiry", label: "Expiry", width: "w-[64px]" },
  { key: "stock", label: "Stock", width: "w-[104px]" },
  { key: "mrp", label: "MRP (₹)", width: "w-[72px]", align: "text-right" },
  { key: "sale", label: "Sale (₹)", width: "w-[72px]", align: "text-right" },
  { key: "status", label: "Status", width: "w-[80px]" },
  { key: "actions", label: "", width: "w-[80px]", align: "text-right" },
];

export function MedicineTable({
  items,
  onEdit,
  onDelete,
  onLabels,
  selectedId = null,
  onSelect,
}: Props) {
  // Thousands of medicines: only the rows on screen are drawn
  const {
    scrollRef,
    virtualRows,
    paddingTop,
    paddingBottom,
    measureElement,
    scrollToIndex,
  } = useVirtualRows({ items, getKey, estimateSize: 50 });

  // Keep the keyboard-selected row on screen
  useEffect(() => {
    if (!selectedId) return;
    const i = items.findIndex((m) => m.id === selectedId);
    if (i >= 0) scrollToIndex(i);
    // scrollToIndex is a new function each render; items/selection decide
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, items]);

  if (items.length === 0) {
    return (
      <EmptyState
        icon={PillBottle}
        title="No medicines found"
        description="Try changing the search or filters, or add a new medicine."
      />
    );
  }

  return (
    <div className="flex-1 min-h-0 rounded-lg border border-border bg-card overflow-hidden flex flex-col">
      <div ref={scrollRef} className="flex-1 overflow-auto">
        {/*
          Fixed layout: column widths never change while scrolling (an
          auto table re-measures the rows on screen, so the header jumped)
        */}
        <table className="w-full min-w-[1100px] table-fixed text-[11px] border-collapse">
          <colgroup>
            {COLUMNS.map((c) => (
              <col key={c.key} className={c.width ?? "w-full"} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "h-9 px-3 text-[10px] font-semibold uppercase tracking-wide bg-primary text-primary-foreground whitespace-nowrap",
                    c.align ?? "text-left",
                  )}
                >
                  {tr(c.label)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <SpacerRow height={paddingTop} colSpan={11} />
            {virtualRows.map((vr) => {
              const m = items[vr.index];
              const level = stockLevel(m);
              const out = level === "out";
              const low = level === "low";
              const looseOk = canSellLoose(m.unit, m.allowLoose);
              const expiryState: ExpiryState = !m.nearestExpiry
                ? "ok"
                : isExpired(m.nearestExpiry)
                  ? "expired"
                  : isExpiringSoon(m.nearestExpiry)
                    ? "expiring"
                    : "ok";

              return (
                <tr
                  key={vr.key}
                  ref={measureElement}
                  data-index={vr.index}
                  data-row-id={m.id}
                  aria-selected={m.id === selectedId}
                  onClick={() => onSelect?.(m)}
                  onDoubleClick={() => onEdit?.(m)}
                  className={cn(
                    "border-b border-border/50 last:border-0 bg-card hover:bg-muted/30",
                    m.id === selectedId && SELECTED_ROW,
                  )}
                >
                  <td className="px-3 py-2.5">
                    <p className="flex min-w-0 items-center gap-1 font-medium text-foreground leading-tight">
                      <span className="truncate" title={m.name}>
                        {m.name}
                      </span>
                      <ScheduleBadge
                        schedule={m.schedule}
                        className="shrink-0"
                      />
                    </p>
                    <p
                      className="truncate text-[10px] text-muted-foreground mt-0.5"
                      title={[m.salt, m.strength].filter(Boolean).join(" · ")}
                    >
                      {[m.salt, m.strength].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </td>
                  <td
                    className="px-3 py-2.5 text-[10px] text-muted-foreground"
                    title={CATEGORY_LABELS[m.category]}
                  >
                    <span className="line-clamp-2 leading-snug">
                      {CATEGORY_LABELS[m.category]}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="truncate leading-tight" title={m.brand}>
                      {m.brand}
                    </p>
                    <p className="truncate text-[10px] text-muted-foreground mt-0.5">
                      {m.hsn}
                    </p>
                  </td>

                  {/* Rack */}
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {m.rack ? (
                      <CodeChip tone="primary" className="max-w-full truncate">
                        {m.rack}
                      </CodeChip>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>

                  {/* Pack */}
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <p className="text-foreground">
                      {formatPackLabel(m.unit, m.unitsPerStrip)}
                    </p>
                    {looseOk && (
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        Loose allowed
                      </p>
                    )}
                  </td>

                  {/* Expiry */}
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <ExpiryText value={m.nearestExpiry} state={expiryState} />
                  </td>

                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span
                      className={cn(
                        "font-semibold tabular-nums",
                        out
                          ? "text-red-500"
                          : low
                            ? "text-orange-600 dark:text-orange-400"
                            : "text-emerald-600 dark:text-emerald-400",
                      )}
                    >
                      {m.stockStrip} {m.unit}
                      {looseOk && m.stockLoose > 0 ? ` + ${m.stockLoose}` : ""}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap">
                    {m.mrp.toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-primary whitespace-nowrap">
                    {m.salePrice.toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <StatusBadge
                      tone={m.status === "active" ? "success" : "neutral"}
                      shape="rounded"
                    >
                      {m.status === "active" ? "Active" : "Inactive"}
                    </StatusBadge>
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    <div className="inline-flex items-center gap-2">
                      {onLabels ? (
                        <button
                          type="button"
                          onClick={() => onLabels(m)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                          aria-label={`Barcode labels for ${m.name}`}
                          title="Print barcode labels"
                        >
                          <Barcode className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                      {onEdit && onDelete ? (
                        <>
                          <button
                            type="button"
                            onClick={() => onEdit(m)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label={`Edit ${m.name}`}
                          >
                            <PencilIcon className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(m)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                            aria-label={`Delete ${m.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
            <SpacerRow height={paddingBottom} colSpan={11} />
          </tbody>
        </table>
      </div>
    </div>
  );
}
