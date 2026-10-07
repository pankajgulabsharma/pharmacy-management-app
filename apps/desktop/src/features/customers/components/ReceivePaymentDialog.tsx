import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModalShell } from "@/components/common/ModalShell";
import { DialogCloseButton } from "@/components/common/DialogCloseButton";
import { FormField } from "@/components/common/FormField";
import { fieldClass, invalidFieldClass } from "@/components/common/formStyles";
import { cn } from "@/lib/utils";
import {
  inrFromPaise,
  isMoneyInput,
  paiseToInput,
} from "@medicare/domain/lib/money";
import { tr } from "@/lib/i18n";
import {
  PAYMENT_IN_LABELS,
  PAYMENT_IN_METHODS,
  type Customer,
  type PaymentInMethod,
} from "@medicare/domain/customers/types";
import { useCustomerStore } from "../store/useCustomerStore";
import { validatePaymentIn } from "@medicare/domain/customers/validation";

type Props = {
  customer: Customer | null;
  owedPaise: number;
  onClose: () => void;
};

/** Money received against udhaar */
export function ReceivePaymentDialog({ customer, owedPaise, onClose }: Props) {
  if (!customer) return null;
  return (
    <Body
      key={customer.id}
      customer={customer}
      owedPaise={owedPaise}
      onClose={onClose}
    />
  );
}

function Body({
  customer,
  owedPaise,
  onClose,
}: {
  customer: Customer;
  owedPaise: number;
  onClose: () => void;
}) {
  const id = useId();
  const recordPayment = useCustomerStore((s) => s.recordPayment);
  const amountRef = useRef<HTMLInputElement>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentInMethod>("cash");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const input = { customerId: customer.id, amount, method, reference, note };
  const check = validatePaymentIn(input, owedPaise);
  const error = submitted && !check.ok ? check.error : undefined;
  const left = check.ok ? owedPaise - check.amountPaise : owedPaise;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!check.ok) return;
    try {
      const p = await recordPayment(input);
      toast.success(`${tr("Payment received")} · ${p.receiptNo}`, {
        description: `${customer.name} · ${inrFromPaise(p.amountPaise)}`,
      });
      onClose();
    } catch (err) {
      toast.error(
        err instanceof Error ? tr(err.message) : tr("Could not save"),
      );
    }
  };

  return (
    <ModalShell
      open
      onClose={onClose}
      labelledBy={`${id}-t`}
      className="max-w-md"
    >
      <form onSubmit={save} noValidate>
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-3.5">
          <div className="min-w-0">
            <h2 id={`${id}-t`} className="text-sm font-semibold">
              {tr("Receive payment")}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {customer.name} · {tr("owes")}{" "}
              <b className="text-foreground">{inrFromPaise(owedPaise)}</b>
            </p>
          </div>
          <DialogCloseButton onClick={onClose} />
        </div>
        <div className="p-5 space-y-3">
          <FormField
            label="Amount received (₹) *"
            htmlFor={`${id}-a`}
            error={error ? tr(error) : undefined}
          >
            <div className="flex gap-2">
              <Input
                id={`${id}-a`}
                ref={amountRef}
                data-autofocus
                inputMode="decimal"
                value={amount}
                onChange={(e) =>
                  isMoneyInput(e.target.value) && setAmount(e.target.value)
                }
                aria-invalid={!!error}
                className={cn(
                  fieldClass,
                  "tabular-nums text-base font-semibold",
                  error && invalidFieldClass,
                )}
              />
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-lg text-[12px] shrink-0"
                onClick={() => {
                  setAmount(paiseToInput(owedPaise));
                  amountRef.current?.focus();
                }}
              >
                {tr("Full")} {inrFromPaise(owedPaise)}
              </Button>
            </div>
          </FormField>
          <div
            className="grid grid-cols-3 gap-1.5"
            role="radiogroup"
            aria-label={tr("Received by")}
          >
            {PAYMENT_IN_METHODS.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={method === m}
                onClick={() => setMethod(m)}
                className={cn(
                  "h-9 rounded-lg border text-[12px] font-medium",
                  method === m
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:bg-muted",
                )}
              >
                {tr(PAYMENT_IN_LABELS[m])}
              </button>
            ))}
          </div>
          {method !== "cash" ? (
            <FormField label="Reference (UTR / approval)" htmlFor={`${id}-r`}>
              <Input
                id={`${id}-r`}
                value={reference}
                maxLength={40}
                onChange={(e) => setReference(e.target.value)}
                className={fieldClass}
              />
            </FormField>
          ) : null}
          <FormField label="Note" htmlFor={`${id}-n`}>
            <Input
              id={`${id}-n`}
              value={note}
              maxLength={200}
              onChange={(e) => setNote(e.target.value)}
              className={fieldClass}
            />
          </FormField>
          <p className="text-[12px] text-muted-foreground">
            {tr("Still owed after this")}:{" "}
            <b className="text-foreground tabular-nums">
              {inrFromPaise(Math.max(0, left))}
            </b>
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="h-9 rounded-lg text-[12px]"
          >
            {tr("Cancel")}
          </Button>
          <Button type="submit" className="h-9 rounded-lg text-[12px]">
            {tr("Save payment")}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}
