import { useId, useState } from "react";
import { Ban } from "lucide-react";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { FormField } from "@/components/common/FormField";
import { fieldClass } from "@/components/common/formStyles";
import { cn } from "@/lib/utils";
import { inrFromPaise } from "@medicare/domain/lib/money";
import { CANCEL_REASONS, type Purchase } from "@medicare/domain/purchases/types";

type Props = {
  purchase: Purchase | null;
  onClose: () => void;
  onConfirm: (id: string, reason: string) => void;
};

const NOTE_MAX = 150;

/** Mounted per invoice (keyed), so the reason always starts empty */
export function CancelPurchaseDialog({ purchase, onClose, onConfirm }: Props) {
  if (!purchase) return null;
  return (
    <CancelForm
      key={purchase.id}
      purchase={purchase}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}

function CancelForm({
  purchase,
  onClose,
  onConfirm,
}: {
  purchase: Purchase;
  onClose: () => void;
  onConfirm: (id: string, reason: string) => void;
}) {
  const id = useId();
  const [reason, setReason] = useState<string>("");
  const [note, setNote] = useState("");

  const needsNote = reason === "Other";
  const valid = reason !== "" && (!needsNote || note.trim().length >= 3);
  const fullReason = note.trim() ? `${reason} — ${note.trim()}` : reason;
  const packs = purchase.totals.totalQty + purchase.totals.totalFreeQty;

  return (
    <ConfirmDialog
      open
      icon={Ban}
      title={`Cancel invoice ${purchase.invoiceNo}?`}
      description={
        <>
          <b>{packs} packs</b> will be removed from inventory and the invoice of{" "}
          <b>{inrFromPaise(purchase.totals.netPaise)}</b> will be marked{" "}
          <b>Cancelled</b>. It stays in the list for your records and can't be
          re-opened.
        </>
      }
      confirmLabel="Cancel invoice"
      confirmDisabled={!valid}
      onConfirm={() => onConfirm(purchase.id, fullReason)}
      onClose={onClose}
    >
      <FormField label="Reason *" htmlFor={`${id}-reason`}>
        <select
          id={`${id}-reason`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className={fieldClass}
        >
          <option value="">Select a reason…</option>
          {CANCEL_REASONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </FormField>
      <FormField
        label={needsNote ? "Details *" : "Details (optional)"}
        htmlFor={`${id}-note`}
        hint={`${note.length}/${NOTE_MAX}`}
      >
        <textarea
          id={`${id}-note`}
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
          rows={2}
          placeholder="e.g. Entered under the wrong supplier"
          className={cn(fieldClass, "h-auto py-2 resize-none")}
        />
      </FormField>
    </ConfirmDialog>
  );
}
