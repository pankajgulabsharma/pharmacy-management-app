import { useId, useRef, useState, type FormEvent } from "react";
import { Ban, FileText, Lock, Pencil, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ModalShell } from "@/components/common/ModalShell";
import { StatusBadge } from "@/components/common/StatusBadge";
import { CodeChip } from "@/components/common/CodeChip";
import { fieldClass, invalidFieldClass } from "@/components/common/formStyles";
import { formatPackLabel } from "@medicare/domain/medicines/types";
import { formatISODate } from "@medicare/domain/lib/date";
import { focusAtEnd } from "@/lib/dom";
import {
  formatPaise,
  inrFromPaise,
  isMoneyInput,
  signedInrFromPaise,
  paiseToInput,
  parseRupees,
  type Paise,
} from "@medicare/domain/lib/money";
import { usePurchaseStore } from "../store/usePurchaseStore";
import { usePurchaseRules } from "../hooks/usePurchaseRules";
import {
  PAYMENT_STATUS_META,
  type PaymentStatus,
  type Purchase,
  type PurchaseReturn,
} from "@medicare/domain/purchases/types";
import {
  calcLine,
  getCreditPaise,
  getDuePaise,
} from "@medicare/domain/purchases/calc";
import type { RuleResult } from "@medicare/domain/purchases/rules";
import { validatePayment } from "@medicare/domain/purchases/validation";

type Actions = {
  onClose: () => void;
  onRecordPayment: (id: string, amountPaise: Paise) => void;
  onEdit: (p: Purchase) => void;
  onCancel: (p: Purchase) => void;
  onReturn: (p: Purchase) => void;
  onViewReturn: (r: PurchaseReturn) => void;
};

type Props = Actions & {
  purchase: Purchase | null;
  status: PaymentStatus | null;
};

/** Invoice view: actions (edit / return / cancel), returns and payments */
export function PurchaseDetailsDialog({ purchase, status, ...actions }: Props) {
  if (!purchase || !status) return null;
  return (
    <Details
      key={purchase.id}
      purchase={purchase}
      status={status}
      {...actions}
    />
  );
}

function Details({
  purchase: p,
  status,
  onClose,
  onRecordPayment,
  onEdit,
  onCancel,
  onReturn,
  onViewReturn,
}: Actions & { purchase: Purchase; status: PaymentStatus }) {
  const titleId = useId();
  const rules = usePurchaseRules(p);
  const allReturns = usePurchaseStore((s) => s.returns);
  const returns = allReturns.filter((r) => r.purchaseId === p.id);
  const creditPaise = getCreditPaise(p);
  const cancelled = p.status === "cancelled";
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
          {p.revision > 1 ? (
            <StatusBadge
              tone="neutral"
              title="Number of times this invoice was edited"
            >
              Rev {p.revision}
            </StatusBadge>
          ) : null}
          {!p.stockPosted ? (
            <StatusBadge tone="neutral">
              <Lock className="h-2.5 w-2.5 mr-1" />
              Imported
            </StatusBadge>
          ) : null}
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

      {/* Actions */}
      {rules && !cancelled ? (
        <ActionBar
          rules={rules}
          onEdit={() => onEdit(p)}
          onReturn={() => onReturn(p)}
          onCancel={() => onCancel(p)}
        />
      ) : null}

      <div className="flex-1 min-h-0 overflow-auto p-4 space-y-3">
        {cancelled ? (
          <div className="flex gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-[11px]">
            <Ban className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">
                Cancelled
                {p.cancelledAt
                  ? ` on ${new Date(p.cancelledAt).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}`
                  : ""}
              </p>
              <p className="text-muted-foreground mt-0.5">
                {p.cancelReason || "No reason recorded"} · its stock was removed
                from inventory.
              </p>
            </div>
          </div>
        ) : null}

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
            {cancelled ? (
              <p className="text-[11px] text-muted-foreground">
                No payments can be recorded on a cancelled invoice.
              </p>
            ) : duePaise > 0 ? (
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
                {creditPaise > 0
                  ? `Nothing to pay. ${inrFromPaise(creditPaise)} is with the supplier as credit.`
                  : "This invoice is fully paid."}
              </p>
            )}

            {returns.length > 0 ? (
              <div className="mt-3 border-t border-border pt-3">
                <p className="text-[11px] font-medium text-foreground mb-1.5">
                  Debit notes ({returns.length})
                </p>
                <ul className="space-y-1">
                  {returns.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => onViewReturn(r)}
                        className="w-full flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[11px] hover:bg-muted"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <CodeChip>{r.returnNo}</CodeChip>
                          <span className="text-muted-foreground truncate">
                            {formatISODate(r.date)} · {r.totalQty} packs
                          </span>
                        </span>
                        <span className="tabular-nums font-medium">
                          {inrFromPaise(r.totalPaise)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
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
            {p.returnedPaise > 0 ? (
              <SumRow label="Returned" value={inrFromPaise(p.returnedPaise)} />
            ) : null}
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

/** Edit / Return / Cancel, each disabled with the rule's reason when not allowed */
function ActionBar({
  rules,
  onEdit,
  onReturn,
  onCancel,
}: {
  rules: { edit: RuleResult; cancel: RuleResult; return: RuleResult };
  onEdit: () => void;
  onReturn: () => void;
  onCancel: () => void;
}) {
  const blocked = [rules.edit, rules.return, rules.cancel].find(
    (r): r is Extract<RuleResult, { allowed: false }> => !r.allowed,
  );
  return (
    <div className="border-b border-border px-4 py-2 shrink-0">
      <div className="flex flex-wrap items-center gap-2">
        <ActionButton
          icon={Pencil}
          label="Edit"
          rule={rules.edit}
          onClick={onEdit}
        />
        <ActionButton
          icon={Undo2}
          label="Return to supplier"
          rule={rules.return}
          onClick={onReturn}
        />
        <ActionButton
          icon={Ban}
          label="Cancel invoice"
          rule={rules.cancel}
          onClick={onCancel}
          danger
        />
      </div>
      {blocked ? (
        <p className="mt-1.5 flex items-start gap-1.5 text-[10px] text-muted-foreground">
          <Lock className="h-3 w-3 shrink-0 mt-px" />
          {blocked.reason}
        </p>
      ) : null}
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  rule,
  onClick,
  danger,
}: {
  icon: typeof Pencil;
  label: string;
  rule: RuleResult;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      disabled={!rule.allowed}
      title={rule.allowed ? label : rule.reason}
      onClick={onClick}
      className={cn(
        "h-8 rounded-lg text-[11px] gap-1.5",
        danger &&
          "text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Button>
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
