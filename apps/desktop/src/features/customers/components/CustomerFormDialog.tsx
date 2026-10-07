import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModalShell } from "@/components/common/ModalShell";
import { DialogCloseButton } from "@/components/common/DialogCloseButton";
import { FormField } from "@/components/common/FormField";
import { fieldClass, invalidFieldClass } from "@/components/common/formStyles";
import { cn } from "@/lib/utils";
import { isMoneyInput, paiseToInput } from "@medicare/domain/lib/money";
import { tr } from "@/lib/i18n";
import {
  CUSTOMER_LIMITS as L,
  type Customer,
} from "@medicare/domain/customers/types";
import { useCustomerStore } from "../store/useCustomerStore";
import {
  digits,
  toCustomerInput,
  validateCustomerForm,
  type CustomerForm,
} from "@medicare/domain/customers/validation";

type Props = {
  open: boolean;
  /** Edit this customer; null = new */
  customer: Customer | null;
  /** Pre-fill the name (quick add from billing) */
  initialName?: string;
  onClose: () => void;
  onSaved?: (c: Customer) => void;
};

const empty = (name = ""): CustomerForm => ({
  name,
  phone: "",
  address: "",
  creditLimit: "",
  notes: "",
  status: "active",
});

export function CustomerFormDialog({
  open,
  customer,
  initialName,
  onClose,
  onSaved,
}: Props) {
  if (!open) return null;
  return (
    <FormBody
      key={customer?.id ?? "new"}
      customer={customer}
      initialName={initialName}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

function FormBody({
  customer,
  initialName,
  onClose,
  onSaved,
}: Omit<Props, "open">) {
  const id = useId();
  const customers = useCustomerStore((s) => s.customers);
  const addCustomer = useCustomerStore((s) => s.addCustomer);
  const updateCustomer = useCustomerStore((s) => s.updateCustomer);
  const [f, setF] = useState<CustomerForm>(() =>
    customer
      ? {
          name: customer.name,
          phone: customer.phone,
          address: customer.address,
          creditLimit: customer.creditLimitPaise
            ? paiseToInput(customer.creditLimitPaise)
            : "",
          notes: customer.notes,
          status: customer.status,
        }
      : empty(initialName),
  );
  const [submitted, setSubmitted] = useState(false);
  const otherPhones = customers
    .filter((c) => c.id !== customer?.id)
    .map((c) => c.phone)
    .filter(Boolean);
  const errors = submitted ? validateCustomerForm(f, otherPhones) : {};
  const set = <K extends keyof CustomerForm>(k: K, v: CustomerForm[K]) =>
    setF((x) => ({ ...x, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(validateCustomerForm(f, otherPhones)).length) return;
    try {
      const c = customer
        ? await updateCustomer(customer.id, toCustomerInput(f))
        : await addCustomer(toCustomerInput(f));
      toast.success(
        customer ? tr("Customer updated") : tr("Customer account created"),
        { description: c.name },
      );
      onSaved?.(c);
      onClose();
    } catch (err) {
      toast.error(
        err instanceof Error ? tr(err.message) : tr("Could not save"),
      );
    }
  };

  const cls = (k: keyof CustomerForm) =>
    cn(fieldClass, errors[k] && invalidFieldClass);

  return (
    <ModalShell
      open
      onClose={onClose}
      labelledBy={`${id}-t`}
      className="max-w-lg"
    >
      <form onSubmit={save} noValidate>
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-3.5">
          <div className="min-w-0">
            <h2 id={`${id}-t`} className="text-sm font-semibold">
              {customer ? tr("Edit customer") : tr("New customer account")}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {tr(
                "Needed for udhaar — the account keeps every bill and payment",
              )}
            </p>
          </div>
          <DialogCloseButton onClick={onClose} />
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField
            label="Name *"
            htmlFor={`${id}-n`}
            error={errors.name}
            className="sm:col-span-2"
          >
            <Input
              id={`${id}-n`}
              data-autofocus
              value={f.name}
              maxLength={L.nameMax}
              onChange={(e) => set("name", e.target.value)}
              aria-invalid={!!errors.name}
              className={cls("name")}
            />
          </FormField>
          <FormField
            label="Mobile"
            htmlFor={`${id}-p`}
            error={errors.phone}
            hint="10 digits — also finds the customer at billing"
          >
            <Input
              id={`${id}-p`}
              inputMode="numeric"
              value={f.phone}
              maxLength={10}
              onChange={(e) => set("phone", digits(e.target.value))}
              aria-invalid={!!errors.phone}
              className={cn(cls("phone"), "tabular-nums")}
            />
          </FormField>
          <FormField
            label="Udhaar limit (₹)"
            htmlFor={`${id}-l`}
            error={errors.creditLimit}
            hint="Leave empty for no limit"
          >
            <Input
              id={`${id}-l`}
              inputMode="decimal"
              value={f.creditLimit}
              onChange={(e) =>
                isMoneyInput(e.target.value) &&
                set("creditLimit", e.target.value)
              }
              aria-invalid={!!errors.creditLimit}
              className={cn(cls("creditLimit"), "tabular-nums")}
            />
          </FormField>
          <FormField
            label="Address"
            htmlFor={`${id}-a`}
            className="sm:col-span-2"
          >
            <Input
              id={`${id}-a`}
              value={f.address}
              maxLength={L.addressMax}
              onChange={(e) => set("address", e.target.value)}
              className={fieldClass}
            />
          </FormField>
          <FormField
            label="Notes"
            htmlFor={`${id}-x`}
            className="sm:col-span-2"
          >
            <Input
              id={`${id}-x`}
              value={f.notes}
              maxLength={L.notesMax}
              onChange={(e) => set("notes", e.target.value)}
              className={fieldClass}
            />
          </FormField>
          {customer ? (
            <label className="sm:col-span-2 inline-flex items-center gap-2 text-[12px]">
              <input
                type="checkbox"
                checked={f.status === "inactive"}
                onChange={(e) =>
                  set("status", e.target.checked ? "inactive" : "active")
                }
              />
              {tr("Inactive — no new udhaar on this account")}
            </label>
          ) : null}
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
            {tr("Save")}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}
