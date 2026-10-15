import { useId, useState } from "react";
import { toast } from "sonner";
import { History } from "lucide-react";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { FormField } from "@/components/common/FormField";
import { fieldClass } from "@/components/common/formStyles";
import { usePurchaseStore } from "@/features/purchases/store/usePurchaseStore";
import { isMoneyInput, parseRupees } from "@medicare/domain/lib/money";
import { toISODate } from "@medicare/domain/lib/date";
import { tr } from "@/lib/i18n";

/** What the shop still owed this supplier before MediCare */
export function OpeningDueDialog({
  supplier,
  onClose,
}: {
  supplier: { id: string; name: string };
  onClose: () => void;
}) {
  const id = useId();
  const add = usePurchaseStore((s) => s.addOpeningDue);
  const today = toISODate(new Date());
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [ref, setRef] = useState("");
  const paise = parseRupees(amount);
  return (
    <ConfirmDialog
      open
      tone="default"
      icon={History}
      title={tr("Old balance — {{name}}", { name: supplier.name })}
      description={tr(
        "What you still owed this supplier before MediCare. You pay it off from Purchases like any invoice — no stock, no GST, not counted as a purchase.",
      )}
      confirmLabel="Save old balance"
      cancelLabel="Cancel"
      confirmDisabled={!paise || paise <= 0}
      onConfirm={() =>
        add(supplier.id, { amountPaise: paise ?? 0, date, ref }).then(
          () => {
            toast.success(tr("Old balance saved"));
            onClose();
          },
          (e: unknown) =>
            toast.error(
              e instanceof Error ? tr(e.message) : tr("Could not save"),
            ),
        )
      }
      onClose={onClose}
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <FormField label="Amount (₹)" htmlFor={`${id}-a`}>
          <input
            id={`${id}-a`}
            data-autofocus
            inputMode="decimal"
            value={amount}
            onChange={(e) =>
              isMoneyInput(e.target.value) && setAmount(e.target.value)
            }
            className={fieldClass}
          />
        </FormField>
        <FormField label="As on" htmlFor={`${id}-d`}>
          <input
            id={`${id}-d`}
            type="date"
            max={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={fieldClass}
          />
        </FormField>
        <FormField label="Old bill no. (optional)" htmlFor={`${id}-r`}>
          <input
            id={`${id}-r`}
            value={ref}
            maxLength={30}
            placeholder="OPENING"
            onChange={(e) => setRef(e.target.value)}
            className={fieldClass}
          />
        </FormField>
      </div>
    </ConfirmDialog>
  );
}
