import { useId, useMemo, useState, type FormEvent } from "react";
import { Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ModalShell } from "@/components/common/ModalShell";
import { FormField } from "@/components/common/FormField";
import { DateInput } from "@/components/common/DateInput";
import { CodeChip } from "@/components/common/CodeChip";
import { EmptyState } from "@/components/common/EmptyState";
import {
  cellInputClass,
  fieldClass,
  invalidFieldClass,
} from "@/components/common/formStyles";
import { TableShell, type TableColumn } from "@/components/common/TableShell";
import { useInventoryStore } from "@/features/inventory/store/useInventoryStore";
import { formatPackLabel } from "@/features/medicines/types";
import { toISODate } from "@/lib/date";
import { formatPaise, inrFromPaise } from "@/lib/money";
import { isIntInput } from "@/lib/sanitize";
import { usePurchaseStore } from "../store/usePurchaseStore";
import {
  RETURN_REASONS,
  type Purchase,
  type PurchaseReturnInput,
  type ReturnReason,
} from "../types";
import { RETURN_NOTES_MAX, getReturnableLines } from "../utils/returns";

type Props = {
  purchase: Purchase | null;
  onClose: () => void;
  /** Return false if saving failed, so the user can correct and retry */
  onSubmit: (input: PurchaseReturnInput) => boolean;
};

const COLUMNS: TableColumn[] = [
  { key: "medicine", label: "Medicine" },
  { key: "batch", label: "Batch", width: "w-[104px]" },
  { key: "expiry", label: "Expiry", width: "w-[72px]" },
  { key: "bought", label: "Bought", width: "w-[72px]", align: "text-right" },
  {
    key: "returned",
    label: "Returned",
    width: "w-[80px]",
    align: "text-right",
  },
  { key: "stock", label: "In stock", width: "w-[76px]", align: "text-right" },
  { key: "qty", label: "Return qty", width: "w-[116px]" },
  {
    key: "rate",
    label: "Credit/pack (₹)",
    width: "w-[108px]",
    align: "text-right",
  },
  {
    key: "amount",
    label: "Amount (₹)",
    width: "w-[100px]",
    align: "text-right",
  },
];

/** Mounted per invoice (keyed) so every return starts empty */
export function PurchaseReturnDialog({ purchase, onClose, onSubmit }: Props) {
  if (!purchase) return null;
  return (
    <ReturnForm
      key={purchase.id}
      purchase={purchase}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}

function ReturnForm({
  purchase,
  onClose,
  onSubmit,
}: {
  purchase: Purchase;
  onClose: () => void;
  onSubmit: (input: PurchaseReturnInput) => boolean;
}) {
  const titleId = useId();
  const batches = useInventoryStore((s) => s.batches);
  const returns = usePurchaseStore((s) => s.returns);

  const [today] = useState(() => toISODate(new Date()));
  const [date, setDate] = useState(today);
  const [reason, setReason] = useState<ReturnReason | "">("");
  const [notes, setNotes] = useState("");
  const [qty, setQty] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const rows = useMemo(
    () => getReturnableLines(purchase, returns, batches),
    [purchase, returns, batches],
  );

  const { totalQty, totalPaise, rowErrors } = useMemo(() => {
    let q = 0;
    let amount = 0;
    const errors: Record<string, string> = {};
    for (const r of rows) {
      const raw = qty[r.line.id] ?? "";
      if (!raw) continue;
      const n = Number(raw);
      if (n > r.max) errors[r.line.id] = `Max ${r.max}`;
      q += n;
      amount += n * r.ratePaise;
    }
    return { totalQty: q, totalPaise: amount, rowErrors: errors };
  }, [rows, qty]);

  const anyReturnable = rows.some((r) => r.max > 0);
  const dateError =
    date < purchase.invoiceDate
      ? "Can't be before the invoice date"
      : date > today
        ? "Can't be in the future"
        : "";
  const formError = !reason
    ? "Choose a reason"
    : totalQty === 0
      ? "Enter a quantity for at least one item"
      : Object.keys(rowErrors).length > 0
        ? "Some quantities are more than allowed"
        : dateError;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (formError || saving || !reason) return;
    setSaving(true);
    const ok = onSubmit({
      purchaseId: purchase.id,
      date,
      reason,
      notes,
      lines: rows
        .map((r) => ({
          purchaseLineId: r.line.id,
          qty: Number(qty[r.line.id] || 0),
        }))
        .filter((l) => l.qty > 0),
    });
    if (!ok) setSaving(false);
  };

  return (
    <ModalShell
      open
      onClose={onClose}
      labelledBy={titleId}
      className="max-w-5xl max-h-[92vh] flex flex-col overflow-hidden"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-orange-500/10 text-orange-600 flex items-center justify-center shrink-0">
            <Undo2 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 id={titleId} className="text-sm font-semibold truncate">
              Purchase return · {purchase.invoiceNo}
            </h2>
            <p className="text-[10px] text-muted-foreground truncate">
              {purchase.supplierName} · a debit note will be created and stock
              reduced
            </p>
          </div>
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

      <form
        onSubmit={handleSubmit}
        noValidate
        className="flex-1 min-h-0 flex flex-col"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-4 pt-3 shrink-0">
          <FormField
            label="Return date *"
            htmlFor={`${titleId}-date`}
            error={submitted ? dateError : undefined}
          >
            <DateInput
              id={`${titleId}-date`}
              value={date}
              min={purchase.invoiceDate}
              max={today}
              onChange={(e) => setDate(e.target.value)}
              className={fieldClass}
            />
          </FormField>
          <FormField
            label="Reason *"
            htmlFor={`${titleId}-reason`}
            error={submitted && !reason ? "Choose a reason" : undefined}
          >
            <select
              id={`${titleId}-reason`}
              data-autofocus
              value={reason}
              onChange={(e) => setReason(e.target.value as ReturnReason)}
              aria-invalid={submitted && !reason}
              className={cn(
                fieldClass,
                submitted && !reason && invalidFieldClass,
              )}
            >
              <option value="">Select…</option>
              {(Object.keys(RETURN_REASONS) as ReturnReason[]).map((k) => (
                <option key={k} value={k}>
                  {RETURN_REASONS[k]}
                </option>
              ))}
            </select>
          </FormField>
          <FormField
            label="Notes"
            htmlFor={`${titleId}-notes`}
            hint={`${notes.length}/${RETURN_NOTES_MAX}`}
          >
            <input
              id={`${titleId}-notes`}
              value={notes}
              onChange={(e) =>
                setNotes(e.target.value.slice(0, RETURN_NOTES_MAX))
              }
              placeholder="e.g. Supplier rep will collect on Monday"
              className={fieldClass}
            />
          </FormField>
        </div>

        <div className="flex-1 min-h-0 flex flex-col px-4 pt-3">
          {anyReturnable ? (
            <TableShell
              columns={COLUMNS}
              minWidthClass="min-w-[920px]"
              headerCellClass="px-2"
            >
              {rows.map((r) => {
                const err = rowErrors[r.line.id];
                const value = qty[r.line.id] ?? "";
                const amount = Number(value || 0) * r.ratePaise;
                return (
                  <tr
                    key={r.line.id}
                    className={cn(
                      "border-b border-border/60 last:border-0 align-top",
                      r.max === 0 && "opacity-50",
                    )}
                  >
                    <td className="px-2 py-2">
                      <p
                        className="font-medium text-foreground truncate"
                        title={r.line.medicineName}
                      >
                        {r.line.medicineName}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                        {r.line.brand} ·{" "}
                        {formatPackLabel(r.line.unit, r.line.unitsPerStrip)}
                      </p>
                    </td>
                    <td className="px-2 py-2">
                      <CodeChip>{r.line.batchNo}</CodeChip>
                    </td>
                    <td className="px-2 py-2 tabular-nums">{r.line.expiry}</td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {r.purchased}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                      {r.alreadyReturned || "—"}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {r.inStock}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1">
                        <input
                          value={value}
                          disabled={r.max === 0}
                          onChange={(e) => {
                            if (isIntInput(e.target.value, 6)) {
                              setQty((q) => ({
                                ...q,
                                [r.line.id]: e.target.value,
                              }));
                            }
                          }}
                          placeholder="0"
                          inputMode="numeric"
                          aria-label={`Return quantity for ${r.line.medicineName}`}
                          aria-invalid={Boolean(err)}
                          className={cn(
                            cellInputClass,
                            "tabular-nums",
                            err && invalidFieldClass,
                          )}
                        />
                        <button
                          type="button"
                          disabled={r.max === 0}
                          onClick={() =>
                            setQty((q) => ({
                              ...q,
                              [r.line.id]: String(r.max),
                            }))
                          }
                          className="h-7 px-1.5 rounded-md text-[10px] font-medium text-primary hover:bg-primary/10 disabled:opacity-40"
                          title={`Return all ${r.max}`}
                        >
                          Max
                        </button>
                      </div>
                      <p
                        className={cn(
                          "mt-0.5 text-[9px] leading-tight truncate",
                          err ? "text-red-500" : "text-muted-foreground",
                        )}
                      >
                        {err ??
                          (r.max === 0
                            ? "Nothing to return"
                            : `Up to ${r.max}`)}
                      </p>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                      {formatPaise(r.ratePaise)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums font-semibold">
                      {amount > 0 ? formatPaise(amount) : "—"}
                    </td>
                  </tr>
                );
              })}
            </TableShell>
          ) : (
            <EmptyState
              icon={Undo2}
              title="Nothing left to return"
              description="Everything from this invoice was already returned, sold or adjusted."
            />
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 border-t border-border px-4 py-3 shrink-0">
          <div className="text-[11px]">
            {submitted && formError ? (
              <p className="text-red-500" role="alert">
                {formError}
              </p>
            ) : (
              <p className="text-muted-foreground">
                {totalQty} packs · credit{" "}
                <span className="font-semibold text-foreground">
                  {inrFromPaise(totalPaise)}
                </span>{" "}
                (incl. GST) will reduce what you owe {purchase.supplierName}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-lg text-[12px]"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!anyReturnable || saving}
              className="h-9 rounded-lg text-[12px] bg-orange-600 hover:bg-orange-700 text-white"
            >
              Create debit note
              {totalPaise > 0 ? ` · ${inrFromPaise(totalPaise)}` : ""}
            </Button>
          </div>
        </div>
      </form>
    </ModalShell>
  );
}
