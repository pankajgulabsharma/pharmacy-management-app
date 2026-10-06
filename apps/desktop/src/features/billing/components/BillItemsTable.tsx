import { memo, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { QtyStepper } from "@/components/common/QtyStepper";
import { SELECTED_ROW } from "@/hooks/useListNavigation";
import { scrollRowIntoView } from "@/lib/dom";
import { formatPackLabel } from "@/features/medicines/types";
import { formatPaise } from "@/lib/money";
import { DISCOUNT_OPTIONS } from "../types";
import type { BillLineView } from "../hooks/useBillingData";
import { sellsLoose, unitsPerPack } from "../utils/allocate";
import { BatchExpiry } from "./BatchExpiry";
import { tr } from "@/lib/i18n";

type Props = {
  lines: BillLineView[];
  /**
   * Line that was just added or increased. `key` changes on every add, so
   * adding the same medicine twice still brings its row into view.
   */
  focus: { lineId: string; key: number } | null;
  onChangeQty: (lineId: string, qtyStrip: number, qtyLoose: number) => void;
  onChangeDiscount: (lineId: string, discountPercent: number) => void;
  onRemove: (lineId: string) => void;
  /** Keyboard-selected line (↑ ↓ when the search box is empty) */
  selectedLineId: string | null;
  onSelectLine: (lineId: string) => void;
  /** Click on a batch → its stock history */
  onBatchHistory: (batchId: string) => void;
};

/** How long the just-added row stays highlighted */
const FLASH_MS = 1200;

export function BillItemsTable({
  lines,
  focus,
  onChangeQty,
  onChangeDiscount,
  onRemove,
  selectedLineId,
  onSelectLine,
  onBatchHistory,
}: Props) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [flashId, setFlashId] = useState<string | null>(null);

  /*
   * Bring the just-added line into view. This also runs on mount: the
   * table is replaced by search results while searching and is mounted
   * again when an item is picked — that is exactly when we must scroll.
   */
  useEffect(() => {
    if (!focus) return;
    const frame = requestAnimationFrame(() => {
      const row = scrollRef.current?.querySelector<HTMLElement>(
        `[data-line-id="${CSS.escape(focus.lineId)}"]`,
      );
      scrollRowIntoView(row ?? null);
      setFlashId(focus.lineId);
    });
    const timer = window.setTimeout(() => setFlashId(null), FLASH_MS);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [focus]);

  if (lines.length === 0) return null;

  const headers: [string, string][] = [
    ["#", "text-left"],
    [t("billing.medicineName"), "text-left"],
    ["Batch / Expiry", "text-left"],
    ["Qty", "text-left"],
    [t("billing.mrp"), "text-right"],
    ["Sale (₹)", "text-right"],
    ["Disc %", "text-right"],
    [t("billing.amount"), "text-right"],
    ["", ""],
  ];

  return (
    <div className="flex-1 min-h-0 rounded-lg border border-border bg-card overflow-hidden flex flex-col">
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
        <table className="w-full text-[11px] border-collapse">
          <thead className="sticky top-0 z-10">
            <tr>
              {headers.map(([label, align], i) => (
                <th
                  key={i}
                  className={cn(
                    "px-2.5 py-2 text-[10px] font-semibold uppercase tracking-wide bg-primary text-primary-foreground whitespace-nowrap",
                    align,
                  )}
                >
                  {tr(label)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((view, index) => (
              <BillRow
                key={view.line.lineId}
                view={view}
                index={index}
                flash={flashId === view.line.lineId}
                selected={selectedLineId === view.line.lineId}
                onSelectLine={onSelectLine}
                onBatchHistory={onBatchHistory}
                onChangeQty={onChangeQty}
                onChangeDiscount={onChangeDiscount}
                onRemove={onRemove}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Every cell vertically centred, whatever the row height */
const ROW_BASE = "border-b border-border/50 last:border-0 [&>td]:align-middle";

const BillRow = memo(function BillRow({
  view,
  index,
  flash,
  selected,
  onSelectLine,
  onBatchHistory,
  onChangeQty,
  onChangeDiscount,
  onRemove,
}: {
  view: BillLineView;
  index: number;
  flash: boolean;
  selected: boolean;
  onSelectLine: Props["onSelectLine"];
  onBatchHistory: Props["onBatchHistory"];
  onChangeQty: Props["onChangeQty"];
  onChangeDiscount: Props["onChangeDiscount"];
  onRemove: Props["onRemove"];
}) {
  const {
    line,
    medicine: m,
    limits,
    allocations,
    amounts,
    error,
    shortExpiry,
  } = view;
  const name = m?.name ?? "Unknown medicine";

  if (!m) {
    return (
      <tr
        data-line-id={line.lineId}
        className={cn(ROW_BASE, "bg-red-50/40 dark:bg-red-950/20")}
      >
        <td className="px-2.5 py-2 text-muted-foreground">{index + 1}</td>
        <td className="px-2.5 py-2 text-red-600" colSpan={7}>
          {error}
        </td>
        <td className="px-2 py-2">
          <RemoveButton name={name} onClick={() => onRemove(line.lineId)} />
        </td>
      </tr>
    );
  }

  const ups = unitsPerPack(m);
  const lse = m.unit === "LSE";
  const looseOk = lse || sellsLoose(m);
  const first = allocations[0];
  const ratePaise = first?.ratePaise ?? 0;
  const split = allocations.length > 1;

  return (
    <tr
      data-line-id={line.lineId}
      aria-selected={selected}
      onClick={() => onSelectLine(line.lineId)}
      className={cn(
        ROW_BASE,
        "hover:bg-muted/30 transition-colors duration-700",
        error && "bg-red-50/40 dark:bg-red-950/20",
        flash && "bg-primary/10",
        selected && SELECTED_ROW,
      )}
    >
      <td className="px-2.5 py-2 text-muted-foreground">{index + 1}</td>

      <td className="px-2.5 py-2">
        <p className="font-medium text-foreground leading-tight">{m.name}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {m.brand} · HSN {m.hsn} · GST {m.gstPercent}%
        </p>
        {m.rack ? (
          <p className="text-[10px] text-muted-foreground">Rack {m.rack}</p>
        ) : null}
        {error ? (
          <p
            className="mt-1 flex items-center gap-1 text-[10px] font-medium text-red-600"
            role="alert"
          >
            <AlertTriangle className="h-3 w-3" />
            {error}
          </p>
        ) : null}
      </td>

      <td className="px-2.5 py-2">
        {allocations.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <div className="space-y-1.5">
            {allocations.map((a) => (
              <BatchExpiry
                key={a.batchId}
                batchNo={a.batchNo}
                expiry={a.expiry}
                onClick={() => onBatchHistory(a.batchId)}
                qty={
                  split
                    ? [
                        a.qtyStrip ? `${a.qtyStrip} ${m.unit}` : "",
                        a.qtyLoose ? `${a.qtyLoose} LSE` : "",
                      ]
                        .filter(Boolean)
                        .join(" + ")
                    : undefined
                }
              />
            ))}
            {shortExpiry ? (
              <p className="text-[9px] font-medium text-amber-600 dark:text-amber-400 whitespace-nowrap">
                {tr("Expires soon — tell the customer")}
              </p>
            ) : null}
          </div>
        )}
      </td>

      <td className="px-2.5 py-2">
        <div className="flex flex-col gap-1">
          {!lse ? (
            <QtyStepper
              value={line.qtyStrip}
              max={limits.maxStrip}
              min={looseOk && line.qtyLoose > 0 ? 0 : 1}
              unitLabel={m.unit}
              label={`${m.unit} of ${m.name}`}
              onChange={(v) => onChangeQty(line.lineId, v, line.qtyLoose)}
            />
          ) : null}
          {looseOk ? (
            <QtyStepper
              value={line.qtyLoose}
              max={limits.maxLoose}
              min={lse || line.qtyStrip === 0 ? 1 : 0}
              unitLabel="LSE"
              label={`Loose units of ${m.name}`}
              onChange={(v) => onChangeQty(line.lineId, line.qtyStrip, v)}
            />
          ) : null}
          {/* Always a single line */}
          <p className="text-[9px] text-muted-foreground leading-tight whitespace-nowrap">
            {formatPackLabel(m.unit, ups)}
            {looseOk && !lse && ratePaise
              ? ` · 1 LSE = ₹${formatPaise(ratePaise / ups)}`
              : ""}
          </p>
        </div>
      </td>

      <td className="px-2.5 py-2 text-right tabular-nums text-muted-foreground">
        {first ? formatPaise(first.mrpPaise) : "—"}
      </td>
      <td className="px-2.5 py-2 text-right tabular-nums">
        {ratePaise ? formatPaise(ratePaise) : "—"}
      </td>

      <td className="px-2 py-2 text-right">
        <select
          value={line.discountPercent}
          onChange={(e) =>
            onChangeDiscount(line.lineId, Number(e.target.value) || 0)
          }
          aria-label={`Discount for ${m.name}`}
          className="h-7 rounded-md border border-border/50 bg-muted/40 px-1.5 text-[11px] outline-none focus:ring-1 focus:ring-ring"
        >
          {DISCOUNT_OPTIONS.map((d) => (
            <option key={d} value={d}>
              {d}%
            </option>
          ))}
        </select>
      </td>

      <td className="px-2.5 py-2 text-right font-semibold tabular-nums text-primary">
        ₹{formatPaise(amounts.amountPaise)}
        {amounts.discountPaise > 0 ? (
          <p className="text-[9px] font-normal text-emerald-600 dark:text-emerald-400">
            −₹{formatPaise(amounts.discountPaise)}
          </p>
        ) : null}
      </td>

      <td className="px-2 py-2">
        <RemoveButton name={m.name} onClick={() => onRemove(line.lineId)} />
      </td>
    </tr>
  );
});

function RemoveButton({
  name,
  onClick,
}: {
  name: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="p-1.5 rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
      aria-label={`Remove ${name}`}
      title="Remove"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
