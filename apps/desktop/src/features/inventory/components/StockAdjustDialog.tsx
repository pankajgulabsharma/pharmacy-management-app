import { useId, useState, type FormEvent } from "react";
import { Package, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ModalShell } from "@/components/common/ModalShell";
import { FormField } from "@/components/common/FormField";
import { fieldClass, invalidFieldClass } from "@/components/common/formStyles";
import { isIntInput } from "@medicare/domain/lib/sanitize";
import { canSellLoose } from "@medicare/domain/medicines/types";
import type {
  InventoryBatch,
  StockAdjustValues,
} from "@medicare/domain/inventory/types";

type Props = {
  open: boolean;
  batch: InventoryBatch | null;
  onClose: () => void;
  onSave: (id: string, values: StockAdjustValues) => void;
};

const REASONS = [
  "Physical count correction",
  "Damaged / broken",
  "Expired disposal",
  "Opening stock",
  "Other",
] as const;

/** Max quantity accepted in one adjustment */
const MAX_QTY_DIGITS = 6;

/**
 * Mounted only while open (keyed by batch), so the fields always start
 * from the batch's current stock — no reset effect needed.
 */
export function StockAdjustDialog({ open, batch, onClose, onSave }: Props) {
  if (!open || !batch) return null;
  return (
    <AdjustForm
      key={batch.id}
      batch={batch}
      onClose={onClose}
      onSave={onSave}
    />
  );
}

function AdjustForm({
  batch,
  onClose,
  onSave,
}: {
  batch: InventoryBatch;
  onClose: () => void;
  onSave: (id: string, values: StockAdjustValues) => void;
}) {
  const titleId = useId();
  const [qtyStrip, setQtyStrip] = useState(String(batch.qtyStrip));
  const [qtyLoose, setQtyLoose] = useState(String(batch.qtyLoose));
  const [reason, setReason] = useState<string>(REASONS[0]);
  const [error, setError] = useState("");

  const looseOk = canSellLoose(batch.unit, batch.allowLoose);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const s = Number(qtyStrip);
    const l = Number(qtyLoose);
    if (
      qtyStrip.trim() === "" ||
      Number.isNaN(s) ||
      s < 0 ||
      Number.isNaN(l) ||
      l < 0
    ) {
      setError("Enter valid non-negative quantities");
      return;
    }
    if (!looseOk && l > 0) {
      setError("Loose not allowed for this pack");
      return;
    }
    onSave(batch.id, {
      qtyStrip: String(s),
      qtyLoose: String(l),
      reason,
    });
  };

  return (
    <ModalShell
      open
      onClose={onClose}
      labelledBy={titleId}
      className="max-w-md"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Package className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 id={titleId} className="text-sm font-semibold truncate">
              Adjust stock
            </h2>
            <p className="text-[10px] text-muted-foreground truncate">
              {batch.medicineName} · {batch.batchNo}
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

      <form onSubmit={handleSubmit} className="p-4 space-y-3" noValidate>
        <p className="text-[11px] text-muted-foreground">
          Current: {batch.qtyStrip} {batch.unit}
          {looseOk && batch.qtyLoose > 0 ? ` + ${batch.qtyLoose} LSE` : ""} ·
          Exp {batch.expiry} · Rack {batch.rack || "—"}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <FormField
            label={`Qty (${batch.unit}) *`}
            htmlFor={`${titleId}-strip`}
          >
            <Input
              id={`${titleId}-strip`}
              data-autofocus
              value={qtyStrip}
              onChange={(e) => {
                if (isIntInput(e.target.value, MAX_QTY_DIGITS)) {
                  setQtyStrip(e.target.value);
                  setError("");
                }
              }}
              aria-invalid={Boolean(error)}
              className={cn(fieldClass, error && invalidFieldClass)}
              inputMode="numeric"
            />
          </FormField>
          <FormField
            label={`Qty (LSE)${looseOk ? "" : " — N/A"}`}
            htmlFor={`${titleId}-loose`}
          >
            <Input
              id={`${titleId}-loose`}
              value={qtyLoose}
              disabled={!looseOk}
              onChange={(e) => {
                if (isIntInput(e.target.value, MAX_QTY_DIGITS)) {
                  setQtyLoose(e.target.value);
                  setError("");
                }
              }}
              className={fieldClass}
              inputMode="numeric"
            />
          </FormField>
        </div>

        <FormField label="Reason" htmlFor={`${titleId}-reason`}>
          <select
            id={`${titleId}-reason`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={fieldClass}
          >
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </FormField>

        {error ? (
          <p className="text-[11px] text-red-500" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-lg text-[12px]"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button type="submit" className="h-9 rounded-lg text-[12px]">
            Save stock
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}
