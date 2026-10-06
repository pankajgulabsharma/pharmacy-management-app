import { useId, useMemo, useState, type FormEvent } from "react";
import { Building2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ModalShell } from "@/components/common/ModalShell";
import { FormField } from "@/components/common/FormField";
import { fieldClass, invalidFieldClass } from "@/components/common/formStyles";
import { isIntInput } from "@medicare/domain/lib/sanitize";
import {
  EMPTY_SUPPLIER_FORM,
  SUPPLIER_LIMITS,
  supplierToForm,
  type Supplier,
  type SupplierFormValues,
} from "@medicare/domain/suppliers/types";
import { checkGstin, toGstinInput } from "@medicare/domain/lib/gstin";
import { validateSupplierForm, type SupplierErrors } from "@medicare/domain/suppliers/validation";

type Props = {
  open: boolean;
  supplier: Supplier | null;
  existing: readonly Supplier[];
  onClose: () => void;
  /** Return false if saving failed so the form stays open */
  onSave: (values: SupplierFormValues, editId: string | null) => boolean;
};

/** Mounted per supplier (keyed) so the form always starts from fresh values */
export function SupplierFormDialog({ open, supplier, ...rest }: Props) {
  if (!open) return null;
  return (
    <SupplierForm key={supplier?.id ?? "new"} supplier={supplier} {...rest} />
  );
}

function SupplierForm({
  supplier,
  existing,
  onClose,
  onSave,
}: Omit<Props, "open">) {
  const id = useId();
  const [values, setValues] = useState<SupplierFormValues>(() =>
    supplier ? supplierToForm(supplier) : EMPTY_SUPPLIER_FORM,
  );
  const [submitted, setSubmitted] = useState(false);

  // Live validation only after the first save attempt
  const errors: SupplierErrors = useMemo(
    () =>
      submitted
        ? validateSupplierForm(values, existing, supplier?.id ?? null)
        : {},
    [submitted, values, existing, supplier?.id],
  );

  const gst = values.gstin.length === 15 ? checkGstin(values.gstin) : null;

  const set =
    <K extends keyof SupplierFormValues>(key: K) =>
    (value: SupplierFormValues[K]) =>
      setValues((v) => ({ ...v, [key]: value }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const errs = validateSupplierForm(values, existing, supplier?.id ?? null);
    if (Object.keys(errs).length > 0) {
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLElement>(
            `[data-form="${id}"] [aria-invalid="true"]`,
          )
          ?.focus(),
      );
      return;
    }
    onSave(values, supplier?.id ?? null);
  };

  const field = (key: keyof SupplierFormValues) =>
    cn(fieldClass, errors[key] && invalidFieldClass);

  return (
    <ModalShell
      open
      onClose={onClose}
      labelledBy={`${id}-title`}
      className="max-w-2xl max-h-[92vh] overflow-y-auto"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3 sticky top-0 bg-card z-10">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Building2 className="h-4 w-4" />
          </div>
          <h2 id={`${id}-title`} className="text-sm font-semibold">
            {supplier ? "Edit supplier" : "Add supplier"}
          </h2>
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

      <form
        data-form={id}
        onSubmit={handleSubmit}
        noValidate
        className="p-4 space-y-3"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField
            label="Supplier / firm name *"
            htmlFor={`${id}-name`}
            error={errors.name}
            className="sm:col-span-2"
          >
            <Input
              id={`${id}-name`}
              data-autofocus
              value={values.name}
              maxLength={SUPPLIER_LIMITS.nameMax}
              onChange={(e) => set("name")(e.target.value)}
              placeholder="e.g. Shree Ganesh Pharma Distributors"
              aria-invalid={Boolean(errors.name)}
              className={field("name")}
            />
          </FormField>
          <FormField label="Status" htmlFor={`${id}-status`}>
            <select
              id={`${id}-status`}
              value={values.status}
              onChange={(e) =>
                set("status")(
                  e.target.value === "inactive" ? "inactive" : "active",
                )
              }
              className={fieldClass}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </FormField>

          <FormField
            label="GSTIN *"
            htmlFor={`${id}-gstin`}
            error={errors.gstin}
            hint={
              gst?.ok
                ? `✓ ${gst.stateName} · PAN ${gst.pan}`
                : "15 characters, e.g. 27AAPFU0939F1ZV"
            }
            className="sm:col-span-2"
          >
            <Input
              id={`${id}-gstin`}
              value={values.gstin}
              onChange={(e) => set("gstin")(toGstinInput(e.target.value))}
              placeholder="27AAPFU0939F1ZV"
              aria-invalid={Boolean(errors.gstin)}
              className={cn(field("gstin"), "font-mono uppercase")}
              autoComplete="off"
              spellCheck={false}
            />
          </FormField>
          <FormField
            label="Credit days *"
            htmlFor={`${id}-days`}
            error={errors.creditDays}
            hint="Payment terms from invoice date"
          >
            <Input
              id={`${id}-days`}
              value={values.creditDays}
              inputMode="numeric"
              onChange={(e) => {
                if (isIntInput(e.target.value, 3))
                  set("creditDays")(e.target.value);
              }}
              aria-invalid={Boolean(errors.creditDays)}
              className={field("creditDays")}
            />
          </FormField>

          <FormField
            label="Drug licence no."
            htmlFor={`${id}-dl`}
            error={errors.drugLicenseNo}
            hint="Wholesale licence (Form 20B / 21B)"
            className="sm:col-span-3"
          >
            <Input
              id={`${id}-dl`}
              value={values.drugLicenseNo}
              maxLength={SUPPLIER_LIMITS.drugLicenseMax}
              onChange={(e) =>
                set("drugLicenseNo")(e.target.value.toUpperCase())
              }
              placeholder="e.g. MH-MZ1-20B-104512"
              aria-invalid={Boolean(errors.drugLicenseNo)}
              className={cn(field("drugLicenseNo"), "font-mono")}
            />
          </FormField>

          <FormField label="Contact person" htmlFor={`${id}-contact`}>
            <Input
              id={`${id}-contact`}
              value={values.contactPerson}
              maxLength={SUPPLIER_LIMITS.contactMax}
              onChange={(e) => set("contactPerson")(e.target.value)}
              className={fieldClass}
            />
          </FormField>
          <FormField
            label="Phone *"
            htmlFor={`${id}-phone`}
            error={errors.phone}
          >
            <Input
              id={`${id}-phone`}
              type="tel"
              value={values.phone}
              maxLength={16}
              onChange={(e) =>
                set("phone")(e.target.value.replace(/[^\d+\s-]/g, ""))
              }
              placeholder="98200 12345"
              aria-invalid={Boolean(errors.phone)}
              className={cn(field("phone"), "tabular-nums")}
            />
          </FormField>
          <FormField label="Email" htmlFor={`${id}-email`} error={errors.email}>
            <Input
              id={`${id}-email`}
              type="email"
              value={values.email}
              maxLength={SUPPLIER_LIMITS.emailMax}
              onChange={(e) => set("email")(e.target.value)}
              placeholder="orders@example.com"
              aria-invalid={Boolean(errors.email)}
              className={field("email")}
            />
          </FormField>

          <FormField
            label="Address"
            htmlFor={`${id}-address`}
            className="sm:col-span-2"
          >
            <Input
              id={`${id}-address`}
              value={values.address}
              maxLength={SUPPLIER_LIMITS.addressMax}
              onChange={(e) => set("address")(e.target.value)}
              className={fieldClass}
            />
          </FormField>
          <FormField label="City *" htmlFor={`${id}-city`} error={errors.city}>
            <Input
              id={`${id}-city`}
              value={values.city}
              maxLength={SUPPLIER_LIMITS.cityMax}
              onChange={(e) => set("city")(e.target.value)}
              aria-invalid={Boolean(errors.city)}
              className={field("city")}
            />
          </FormField>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-border">
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-lg text-[12px]"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button type="submit" className="h-9 rounded-lg text-[12px]">
            {supplier ? "Save changes" : "Add supplier"}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}
