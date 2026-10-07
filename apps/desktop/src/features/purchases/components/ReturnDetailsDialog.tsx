import { useId } from "react";
import { FileMinus, X } from "lucide-react";
import { ModalShell } from "@/components/common/ModalShell";
import { CodeChip } from "@/components/common/CodeChip";
import { StatusBadge } from "@/components/common/StatusBadge";
import { formatPackLabel } from "@medicare/domain/medicines/types";
import { formatISODate } from "@medicare/domain/lib/date";
import { formatPaise, inrFromPaise } from "@medicare/domain/lib/money";
import { cn } from "@/lib/utils";
import {
  RETURN_REASONS,
  type PurchaseReturn,
} from "@medicare/domain/purchases/types";

type Props = {
  ret: PurchaseReturn | null;
  onClose: () => void;
};

/** Read-only debit note */
export function ReturnDetailsDialog({ ret, onClose }: Props) {
  const titleId = useId();
  if (!ret) return null;

  return (
    <ModalShell
      open
      onClose={onClose}
      labelledBy={titleId}
      className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-orange-500/10 text-orange-600 flex items-center justify-center shrink-0">
            <FileMinus className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 id={titleId} className="text-sm font-semibold truncate">
              Debit note <span className="font-mono">{ret.returnNo}</span>
            </h2>
            <p className="text-[10px] text-muted-foreground truncate">
              {ret.supplierName} · GSTIN {ret.supplierGstin}
            </p>
          </div>
          <StatusBadge tone="caution" className="ml-1">
            {RETURN_REASONS[ret.reason]}
          </StatusBadge>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-4 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
          <Meta label="Return date" value={formatISODate(ret.date)} />
          <Meta label="Against invoice" value={ret.invoiceNo} mono />
          <Meta
            label="Items"
            value={`${ret.lines.length} · ${ret.totalQty} packs`}
          />
          <Meta
            label="Created"
            value={new Date(ret.createdAt).toLocaleString("en-IN", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          />
        </div>

        {ret.notes ? (
          <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-[11px]">
            {ret.notes}
          </p>
        ) : null}

        <div className="rounded-lg border border-border overflow-auto">
          <table className="w-full min-w-[720px] border-collapse text-[11px]">
            <thead>
              <tr className="bg-muted/60 text-muted-foreground">
                {[
                  ["Medicine", "text-left"],
                  ["Batch", "text-left"],
                  ["Expiry", "text-left"],
                  ["Qty", "text-right"],
                  ["Credit/pack (₹)", "text-right"],
                  ["GST", "text-right"],
                  ["Amount (₹)", "text-right"],
                ].map(([label, align]) => (
                  <th
                    key={label}
                    scope="col"
                    className={cn(
                      "px-3 py-2 text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap",
                      align,
                    )}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ret.lines.map((l) => (
                <tr key={l.id} className="border-t border-border/60">
                  <td className="px-3 py-2">
                    <p className="font-medium text-foreground">
                      {l.medicineName}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {l.brand} · {formatPackLabel(l.unit, l.unitsPerStrip)}
                    </p>
                  </td>
                  <td className="px-3 py-2">
                    <CodeChip>{l.batchNo}</CodeChip>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{l.expiry}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{l.qty}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatPaise(l.ratePaise)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {l.gstPercent}%
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">
                    {formatPaise(l.amountPaise)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="ml-auto max-w-xs rounded-lg border border-border bg-muted/20 p-3 text-[11px] space-y-1.5">
          <Row
            label="Taxable"
            value={inrFromPaise(ret.totalPaise - ret.gstPaise)}
          />
          <Row
            label="CGST"
            value={inrFromPaise(Math.floor(ret.gstPaise / 2))}
          />
          <Row
            label="SGST"
            value={inrFromPaise(ret.gstPaise - Math.floor(ret.gstPaise / 2))}
          />
          <div className="flex items-baseline justify-between border-t border-border pt-2">
            <span className="font-semibold">Total credit</span>
            <span className="text-sm font-bold tabular-nums">
              {inrFromPaise(ret.totalPaise)}
            </span>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

function Meta({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border px-3 py-2 min-w-0">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "font-medium text-foreground truncate tabular-nums",
          mono && "font-mono",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums text-foreground">{value}</span>
    </div>
  );
}
