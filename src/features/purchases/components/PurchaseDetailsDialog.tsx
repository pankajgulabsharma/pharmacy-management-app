import { useId, useRef, useState, type FormEvent } from "react";
import { FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ModalShell } from "@/components/common/ModalShell";
import { StatusBadge } from "@/components/common/StatusBadge";
import { CodeChip } from "@/components/common/CodeChip";
import { fieldClass, invalidFieldClass } from "@/components/common/formStyles";
import { formatPackLabel } from "@/features/medicines/types";
import { formatISODate } from "@/lib/date";
import { focusAtEnd } from "@/lib/dom";
import {
  formatPaise,
  inrFromPaise,
  isMoneyInput,
  signedInrFromPaise,
  paiseToInput,
  parseRupees,
  type Paise,
} from "@/lib/money";
import {
  PAYMENT_STATUS_META,
  type PaymentStatus,
  type Purchase,
} from "../types";
import { calcLine, getDuePaise } from "../utils/calc";
import { validatePayment } from "../utils/validation";

type Props = {
  purchase: Purchase | null;
  status: PaymentStatus | null;
  onClose: () => void;
  onRecordPayment: (id: string, amountPaise: Paise) => void;
};

/** Read-only invoice view + record a payment against the balance */
export function PurchaseDetailsDialog({
  purchase,
  status,
  onClose,
  onRecordPayment,
}: Props) {
  if (!purchase || !status) return null;
  return (
    <Details
      key={purchase.id}
      purchase={purchase}
      status={status}
      onClose={onClose}
      onRecordPayment={onRecordPayment}
    />
  );
}

function Details({
  purchase: p,
  status,
  onClose,
  onRecordPayment,
}: {
  purchase: Purchase;
  status: PaymentStatus;
  onClose: () => void;
  onRecordPayment: (id: string, amountPaise: Paise) => void;
}) {
  const titleId = useId();
  const amountRef = useRef<HTMLInputElement>(null);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const duePaise = getDuePaise(p);
  const meta = PAYMENT_STATUS_META[status];
  const t = p.totals;

  const handlePay = (e: FormEvent) => {
    e.preventDefault();
    const err = validatePayment(amount, duePaise);
    if (err) {
      setError(err);
      return;
    }
    onRecordPayment(p.id, parseRupees(amount) ?? 0);
    setAmount("");
    setError(null);
  };

  return (
    <ModalShell
      open
      onClose={onClose}
      labelledBy={titleId}
      className="max-w-5xl max-h-[90vh] flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <FileText className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 id={titleId} className="text-sm font-semibold truncate">
              <span className="font-mono">{p.invoiceNo}</span>
            </h2>
            <p className="text-[10px] text-muted-foreground truncate">
              {p.supplierName} · GSTIN {p.supplierGstin}
            </p>
          </div>
          <StatusBadge tone={meta.tone} className="ml-1">
            {meta.label}
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
        {/* Meta */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
          <Meta label="Invoice date" value={formatISODate(p.invoiceDate)} />
          <Meta label="Payment due" value={formatISODate(p.dueDate)} />
          <Meta
            label="Items"
            value={`${t.lineCount} · ${t.totalQty} + ${t.totalFreeQty} free`}
          />
          <Meta
            label="Entered on"
            value={new Date(p.createdAt).toLocaleString("en-IN", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          />
        </div>

        {p.notes ? (
          <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-[11px] text-foreground">
            {p.notes}
          </p>
        ) : null}

        {/* Lines */}
        <div className="rounded-lg border border-border overflow-auto">
          <table className="w-full min-w-[860px] border-collapse text-[11px]">
            <thead>
              <tr className="bg-muted/60 text-muted-foreground">
                {[
                  ["Medicine", "text-left"],
                  ["Batch", "text-left"],
                  ["Expiry", "text-left"],
                  ["Qty", "text-right"],
                  ["Rate (₹)", "text-right"],
                  ["MRP (₹)", "text-right"],
                  ["Disc", "text-right"],
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
              {p.lines.map((l) => {
                const a = calcLine(l);
                return (
                  <tr key={l.id} className="border-t border-border/60">
                    <td className="px-3 py-2">
                      <p className="font-medium text-foreground leading-tight">
                        {l.medicineName}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {l.brand} · {formatPackLabel(l.unit, l.unitsPerStrip)}
                      </p>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <CodeChip>{l.batchNo}</CodeChip>
                    </td>
                    <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                      {l.expiry}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                      {l.qty}
                      {l.freeQty > 0 ? (
                        <span className="text-muted-foreground">
                          {" "}
                          + {l.freeQty}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatPaise(l.ratePaise)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {formatPaise(l.mrpPaise)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {l.discountPercent > 0 ? `${l.discountPercent}%` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {l.gstPercent}%
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-foreground">
                      {formatPaise(a.totalPaise)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals + payment */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] items-start gap-3">
          <div className="rounded-lg border border-border p-3">
            {duePaise > 0 ? (
              <form onSubmit={handlePay} noValidate className="space-y-2">
                <p className="text-[11px] font-medium text-foreground">
                  Record payment
                </p>
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0 p-0.5">
                    <input
                      ref={amountRef}
                      value={amount}
                      onChange={(e) => {
                        if (isMoneyInput(e.target.value)) {
                          setAmount(e.target.value);
                          setError(null);
                        }
                      }}
                      placeholder={`Up to ${inrFromPaise(duePaise)}`}
                      inputMode="decimal"
                      aria-label="Payment amount in rupees"
                      aria-invalid={Boolean(error)}
                      className={cn(
                        fieldClass,
                        "tabular-nums",
                        error && invalidFieldClass,
                      )}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 rounded-lg text-[12px] mt-0.5"
                    onClick={() => {
                      setAmount(paiseToInput(duePaise));
                      setError(null);
                      focusAtEnd(amountRef.current);
                    }}
                  >
                    Full balance
                  </Button>
                  <Button
                    type="submit"
                    className="h-9 rounded-lg text-[12px] mt-0.5"
                  >
                    Record
                  </Button>
                </div>
                {error ? (
                  <p className="text-[10px] text-red-500" role="alert">
                    {error}
                  </p>
                ) : (
                  <p className="text-[10px] text-muted-foreground">
                    Paid so far ₹{formatPaise(p.paidPaise)} of ₹
                    {formatPaise(t.netPaise)}
                  </p>
                )}
              </form>
            ) : (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                This invoice is fully paid.
              </p>
            )}
          </div>

          <div className="rounded-lg border border-border bg-muted/20 p-3 text-[11px] space-y-1.5">
            <SumRow label="Gross" value={inrFromPaise(t.grossPaise)} />
            {t.discountPaise > 0 && (
              <SumRow label="Discount" value={inrFromPaise(-t.discountPaise)} />
            )}
            <SumRow label="Taxable" value={inrFromPaise(t.taxablePaise)} />
            <SumRow label="CGST" value={inrFromPaise(t.cgstPaise)} />
            <SumRow label="SGST" value={inrFromPaise(t.sgstPaise)} />
            {t.roundOffPaise !== 0 && (
              <SumRow
                label="Round off"
                value={signedInrFromPaise(t.roundOffPaise)}
              />
            )}
            <div className="flex items-baseline justify-between border-t border-border pt-2">
              <span className="font-semibold text-foreground">Net</span>
              <span className="text-sm font-bold tabular-nums">
                {inrFromPaise(t.netPaise)}
              </span>
            </div>
            <SumRow label="Paid" value={inrFromPaise(p.paidPaise)} />
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground">Balance</span>
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  duePaise > 0
                    ? "text-orange-600 dark:text-orange-400"
                    : "text-emerald-600 dark:text-emerald-400",
                )}
              >
                {inrFromPaise(duePaise)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2 min-w-0">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="font-medium text-foreground truncate tabular-nums">
        {value}
      </p>
    </div>
  );
}

function SumRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums text-foreground">{value}</span>
    </div>
  );
}
