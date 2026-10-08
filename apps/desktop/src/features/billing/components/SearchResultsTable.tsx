import { ScheduleBadge } from "@/components/common/ScheduleBadge";
import { memo, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ScanBarcode, SearchX } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/common/EmptyState";
import { scrollRowIntoView } from "@/lib/dom";
import { CodeChip } from "@/components/common/CodeChip";
import { BatchExpiry } from "./BatchExpiry";
import { formatPaise } from "@medicare/domain/lib/money";
import type { SellableItem } from "../hooks/useBillingData";
import { tr } from "@/lib/i18n";

type Props = {
  results: SellableItem[];
  query: string;
  focusedIndex: number;
  onSelect: (item: SellableItem) => void;
  onHoverIndex: (index: number) => void;
};

export function SearchResultsTable({
  results,
  query,
  focusedIndex,
  onSelect,
  onHoverIndex,
}: Props) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Arrow keys move the highlight — keep that row on screen
  useEffect(() => {
    scrollRowIntoView(
      scrollRef.current?.querySelector<HTMLElement>(
        `[data-index="${focusedIndex}"]`,
      ) ?? null,
    );
  }, [focusedIndex, results]);

  if (!query.trim()) {
    return <EmptyState icon={ScanBarcode} title={t("billing.typeToSearch")} />;
  }
  if (results.length === 0) {
    return (
      <EmptyState
        icon={SearchX}
        title={`${t("billing.noResults")} “${query.trim()}”`}
        description="Check the spelling, or search by salt, barcode or batch number."
      />
    );
  }

  const headers: [string, string][] = [
    [t("billing.medicineName"), "text-left"],
    [t("billing.rack"), "text-left"],
    ["Batch / Expiry", "text-left"],
    [t("billing.stock"), "text-left"],
    [t("billing.mrp"), "text-right"],
    [t("billing.salePrice"), "text-right"],
  ];

  return (
    <div className="flex-1 min-h-0 rounded-lg border border-border bg-card overflow-hidden flex flex-col">
      <div ref={scrollRef} className="flex-1 overflow-auto">
        <table
          className="w-full text-[11px] border-collapse"
          role="listbox"
          aria-label="Search results"
        >
          <thead className="sticky top-0 z-20">
            <tr>
              {headers.map(([label, align]) => (
                <th
                  key={label}
                  className={cn(
                    "px-3 py-2 text-[10px] font-semibold uppercase tracking-wide bg-primary text-primary-foreground",
                    align,
                  )}
                >
                  {tr(label)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.map((item, index) => (
              <ResultRow
                key={item.medicine.id}
                item={item}
                index={index}
                active={focusedIndex === index}
                onSelect={onSelect}
                onHoverIndex={onHoverIndex}
              />
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-3 py-1.5 border-t border-border text-[10px] text-muted-foreground flex justify-between bg-card shrink-0">
        <span>
          {t("billing.showingResults", { count: results.length })} “{query}”
        </span>
        <span className="text-primary font-medium">
          {t("billing.keyboardHint")}
        </span>
      </div>
    </div>
  );
}

const ResultRow = memo(function ResultRow({
  item,
  index,
  active,
  onSelect,
  onHoverIndex,
}: {
  item: SellableItem;
  index: number;
  active: boolean;
  onSelect: (item: SellableItem) => void;
  onHoverIndex: (index: number) => void;
}) {
  const { medicine: m, nextBatch, limits } = item;
  const inStock = limits.maxStrip + limits.maxLoose > 0;

  return (
    <tr
      role="option"
      aria-selected={active}
      data-index={index}
      aria-disabled={!inStock}
      onMouseEnter={() => onHoverIndex(index)}
      onClick={() => inStock && onSelect(item)}
      className={cn(
        "border-b border-border/50 last:border-0 transition-colors bg-card",
        inStock ? "cursor-pointer" : "opacity-50 cursor-not-allowed",
        active && "bg-primary/10 ring-1 ring-inset ring-primary/30",
      )}
    >
      <td className="px-3 py-2">
        <p className="font-medium text-foreground">
          {m.name} <ScheduleBadge schedule={m.schedule} />
        </p>
        <p className="text-[10px] text-muted-foreground">
          {m.salt || "—"} · {m.brand}
        </p>
      </td>
      <td className="px-3 py-2">
        {m.rack ? <CodeChip tone="primary">{m.rack}</CodeChip> : "—"}
      </td>
      <td className="px-3 py-2">
        {nextBatch ? (
          <BatchExpiry batchNo={nextBatch.batchNo} expiry={nextBatch.expiry} />
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-2">
        {inStock ? (
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">
            {m.unit === "LSE"
              ? `${limits.maxLoose} LSE`
              : `${limits.maxStrip} ${m.unit}${limits.maxLoose > 0 && m.allowLoose ? ` · loose ok` : ""}`}
          </span>
        ) : (
          <span className="text-red-500 font-semibold">
            {tr("Out of stock")}
          </span>
        )}
        {item.expiredStrip > 0 ? (
          <p className="text-[10px] text-red-500/80">
            {item.expiredStrip} expired — not sold
          </p>
        ) : null}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {formatPaise(item.mrpPaise)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums font-semibold text-primary">
        {formatPaise(item.ratePaise)}
      </td>
    </tr>
  );
});
