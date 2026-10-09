import { useEffect, useId, useMemo, useState } from "react";
import { History, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ModalShell } from "@/components/common/ModalShell";
import { CodeChip } from "@/components/common/CodeChip";
import { useMedicineStore } from "@/features/medicines/store/useMedicineStore";
import { useInventoryStore } from "../store/useInventoryStore";
import type {
  StockMovement,
  StockMovementType,
} from "@medicare/domain/inventory/types";
import { apiGet } from "@/lib/api";

type Props = {
  /** Batch to show; null = closed */
  batchId: string | null;
  onClose: () => void;
};

const TYPE: Record<StockMovementType, { label: string; tone: string }> = {
  opening: { label: "Opening stock", tone: "bg-muted text-muted-foreground" },
  purchase: {
    label: "Purchase received",
    tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400",
  },
  purchase_reversal: {
    label: "Purchase cancelled / edited",
    tone: "bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-400",
  },
  purchase_return: {
    label: "Returned to supplier",
    tone: "bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-400",
  },
  sale: { label: "Sold", tone: "bg-primary/10 text-primary" },
  sale_return: {
    label: "Customer returned",
    tone: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400",
  },
  adjustment: {
    label: "Stock adjusted",
    tone: "bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-400",
  },
};

const when = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function qtyText(strip: number, loose: number, unit: string) {
  const parts: string[] = [];
  if (strip) parts.push(`${strip > 0 ? "+" : "−"}${Math.abs(strip)} ${unit}`);
  if (loose) parts.push(`${loose > 0 ? "+" : "−"}${Math.abs(loose)} LSE`);
  return parts.join(" ") || "0";
}

const balance = (strip: number, loose: number, unit: string) =>
  unit === "LSE"
    ? `${loose} LSE`
    : `${strip} ${unit}${loose ? ` + ${loose} LSE` : ""}`;

/**
 * The full story of one batch from the stock log: where it came from,
 * every sale / return / adjustment, and the quantity after each step.
 */
export function BatchHistoryDialog({ batchId, onClose }: Props) {
  const titleId = useId();
  const batches = useInventoryStore((s) => s.batches);
  const medicines = useMedicineStore((s) => s.medicines);
  const batch = batches.find((b) => b.id === batchId) ?? null;

  // The full history lives on the server (counters don't keep every sale's
  // movement); fetched again whenever this batch's stock changes
  const [loaded, setLoaded] = useState<{
    for: string;
    movements: StockMovement[];
    error?: string;
  } | null>(null);
  useEffect(() => {
    if (!batchId) return;
    let live = true;
    apiGet<{ movements: StockMovement[] }>(
      `/api/stock/batches/${encodeURIComponent(batchId)}/movements`,
    ).then(
      (r) => live && setLoaded({ for: batchId, movements: r.movements }),
      (e: Error) =>
        live && setLoaded({ for: batchId, movements: [], error: e.message }),
    );
    return () => {
      live = false;
    };
  }, [batchId, batch]);
  const movements = loaded?.for === batchId ? loaded.movements : null;

  const data = useMemo(() => {
    if (!batchId || !movements) return null;
    const medicine =
      medicines.find((m) => m.id === (batch?.medicineId ?? "")) ?? null;
    // Oldest first, with the running balance after each movement
    const own = movements
      .filter((m) => m.batchId === batchId)
      .sort((a, b) => a.at.localeCompare(b.at));
    let strip = 0;
    let loose = 0;
    const rows = own.map((m) => {
      strip += m.qtyStripDelta;
      loose += m.qtyLooseDelta;
      return { m, strip, loose };
    });
    return { medicine, rows };
  }, [batchId, batch, movements, medicines]);

  if (!batchId) return null;
  const medicine = data?.medicine ?? null;
  const rows = data?.rows ?? [];
  const unit = medicine?.unit ?? "STP";
  const matches =
    batch && data
      ? rows.at(-1)?.strip === batch.qtyStrip &&
        rows.at(-1)?.loose === batch.qtyLoose
      : true;

  return (
    <ModalShell
      open
      onClose={onClose}
      labelledBy={titleId}
      className="max-w-3xl max-h-[88vh] flex flex-col overflow-hidden"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <History className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 id={titleId} className="text-sm font-semibold truncate">
              Batch history · {medicine?.name ?? "Unknown medicine"}
            </h2>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
              <CodeChip>{batch?.batchNo ?? "—"}</CodeChip>
              Exp {batch?.expiry ?? "—"} · now in stock{" "}
              <b className="text-foreground">
                {batch ? balance(batch.qtyStrip, batch.qtyLoose, unit) : "—"}
              </b>
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {!data || rows.length === 0 ? (
          <p className="p-8 text-center text-[12px] text-muted-foreground">
            {!data
              ? "Loading…"
              : loaded?.error
                ? loaded.error
                : "No stock movements recorded for this batch."}
          </p>
        ) : (
          <table className="w-full text-[11px] border-collapse">
            <thead className="sticky top-0 z-10">
              <tr>
                {[
                  "Date & time",
                  "What happened",
                  "Reference",
                  "Change",
                  "Balance after",
                ].map((h, i) => (
                  <th
                    key={h}
                    className={cn(
                      "h-9 px-3 bg-primary text-primary-foreground text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap",
                      i >= 3 ? "text-right" : "text-left",
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ m, strip, loose }, i) => (
                <tr
                  key={m.id}
                  className={cn(
                    "border-b border-border/60 last:border-0 [&>td]:align-middle",
                    i % 2 === 1 && "bg-muted/20",
                  )}
                >
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums text-muted-foreground">
                    {when.format(new Date(m.at))}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap",
                        TYPE[m.type].tone,
                      )}
                    >
                      {TYPE[m.type].label}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-foreground/90">{m.note}</td>
                  <td
                    className={cn(
                      "px-3 py-2 text-right tabular-nums font-semibold whitespace-nowrap",
                      m.qtyStripDelta + m.qtyLooseDelta >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400",
                    )}
                  >
                    {qtyText(m.qtyStripDelta, m.qtyLooseDelta, unit)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                    {balance(strip, loose, unit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p
        className={cn(
          "border-t border-border px-4 py-2 text-[10px] shrink-0",
          matches ? "text-muted-foreground" : "text-red-600",
        )}
      >
        {matches
          ? "Every change to this batch is recorded here — the last balance equals the stock on the shelf."
          : "Warning: the recorded history doesn't add up to the current stock. Please do a physical count."}
      </p>
    </ModalShell>
  );
}
