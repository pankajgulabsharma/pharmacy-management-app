import { useId, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModalShell } from "@/components/common/ModalShell";
import { FormField as Field } from "@/components/common/FormField";
import { fieldClass } from "@/components/common/formStyles";
import { isMoneyInput } from "@medicare/domain/lib/money";
import { isIntInput } from "@medicare/domain/lib/sanitize";
import { newInStoreBarcode } from "@medicare/domain/printing/labels";
import { useMedicineStore } from "../store/useMedicineStore";
import { GST_RATES, isGstRate } from "@medicare/domain/lib/gst";
import {
  DRUG_SCHEDULES,
  SCHEDULE_LABELS,
  type DrugSchedule,
} from "@medicare/domain/medicines/schedule";
import type {
  Medicine,
  MedicineFormValues,
  MedicineCategory,
  PackUnit,
} from "@medicare/domain/medicines/types";
import {
  CATEGORY_LABELS,
  PACK_UNIT_LABELS,
  defaultsForCategory,
  defaultsForPackUnit,
  emptyMedicineForm,
  medicineToForm,
  unitsPerPackHint,
} from "@medicare/domain/medicines/types";
import {
  validateMedicineForm,
  type FieldErrors,
} from "@medicare/domain/medicines/validation";

type Props = {
  open: boolean;
  medicine: Medicine | null;
  onClose: () => void;
  onSave: (values: MedicineFormValues, editId: string | null) => void;
};

/**
 * Mounts the form only while open (keyed by the medicine), so every open
 * starts from fresh values — no reset effect needed.
 */
export function MedicineFormDialog({ open, medicine, onClose, onSave }: Props) {
  if (!open) return null;
  return (
    <MedicineForm
      key={medicine?.id ?? "new"}
      medicine={medicine}
      onClose={onClose}
      onSave={onSave}
    />
  );
}

function MedicineForm({ medicine, onClose, onSave }: Omit<Props, "open">) {
  const titleId = useId();
  const isEdit = Boolean(medicine);
  const [values, setValues] = useState<MedicineFormValues>(() =>
    medicine ? medicineToForm(medicine) : emptyMedicineForm(),
  );
  const [errors, setErrors] = useState<FieldErrors>({});

  const setField =
    <K extends keyof MedicineFormValues>(key: K) =>
    (value: MedicineFormValues[K]) => {
      setValues((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    };

  const onCategoryChange = (category: MedicineCategory) => {
    const d = defaultsForCategory(category);
    setValues((prev) => ({
      ...prev,
      category,
      unit: d.unit,
      unitsPerStrip: d.unitsPerStrip,
      allowLoose: d.allowLoose,
    }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const nextErrors = validateMedicineForm(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onSave(values, medicine?.id ?? null);
  };

  const unitsLabel =
    values.unit === "BOX"
      ? "Strips per box *"
      : values.unit === "STP"
        ? "Units per strip *"
        : "Units per pack *";

  return (
    <ModalShell
      open
      onClose={onClose}
      labelledBy={titleId}
      className="max-w-3xl max-h-[90vh] overflow-y-auto overflow-x-hidden"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-5 py-3">
        <h2 id={titleId} className="text-sm font-semibold">
          {isEdit ? "Edit Medicine" : "Add Medicine"}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-4" noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <Field
            label="Medicine name *"
            error={errors.name}
            className="sm:col-span-2"
          >
            <Input
              value={values.name}
              onChange={(e) => setField("name")(e.target.value)}
              data-autofocus
              maxLength={120}
              placeholder="e.g. Dolo 650 / Ascoril LS Syrup"
              className={fieldClass}
              autoComplete="off"
            />
          </Field>
          <Field label="Category *">
            <select
              value={values.category}
              onChange={(e) =>
                onCategoryChange(e.target.value as MedicineCategory)
              }
              className={fieldClass}
            >
              {(Object.keys(CATEGORY_LABELS) as MedicineCategory[]).map(
                (key) => (
                  <option key={key} value={key}>
                    {CATEGORY_LABELS[key]}
                  </option>
                ),
              )}
            </select>
          </Field>
          <Field label="Status">
            <select
              value={values.status}
              onChange={(e) =>
                setField("status")(
                  e.target.value as MedicineFormValues["status"],
                )
              }
              className={fieldClass}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Salt / composition" className="sm:col-span-2">
            <Input
              value={values.salt}
              onChange={(e) => setField("salt")(e.target.value)}
              className={fieldClass}
              autoComplete="off"
            />
          </Field>
          <Field label="Brand *" error={errors.brand}>
            <Input
              value={values.brand}
              onChange={(e) => setField("brand")(e.target.value)}
              className={fieldClass}
              autoComplete="off"
            />
          </Field>
          <Field label="HSN *" error={errors.hsn}>
            <Input
              value={values.hsn}
              onChange={(e) => {
                if (isIntInput(e.target.value, 8))
                  setField("hsn")(e.target.value);
              }}
              className={fieldClass}
              inputMode="numeric"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <Field
            label="Barcode"
            hint="Scan the pack, or Generate one for items without a barcode"
          >
            <div className="flex gap-1.5">
              <Input
                value={values.barcode}
                onChange={(e) => setField("barcode")(e.target.value)}
                className={fieldClass}
              />
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-lg text-[11px] px-2 shrink-0"
                title="Make a shop barcode (starts with 2 — never clashes with a company barcode)"
                onClick={() =>
                  setField("barcode")(
                    newInStoreBarcode(
                      new Set(
                        useMedicineStore
                          .getState()
                          .medicines.map((m) => m.barcode)
                          .filter(Boolean),
                      ),
                    ),
                  )
                }
              >
                Generate
              </Button>
            </div>
          </Field>
          <Field label="Rack">
            <Input
              value={values.rack}
              onChange={(e) => setField("rack")(e.target.value)}
              className={fieldClass}
            />
          </Field>
          <Field label="Pack unit *">
            <select
              value={values.unit}
              onChange={(e) => {
                const unit = e.target.value as PackUnit;
                const d = defaultsForPackUnit(unit);
                setValues((prev) => ({
                  ...prev,
                  unit,
                  unitsPerStrip: d.unitsPerStrip,
                  allowLoose: d.allowLoose,
                }));
              }}
              className={fieldClass}
            >
              {(Object.keys(PACK_UNIT_LABELS) as PackUnit[]).map((u) => (
                <option key={u} value={u}>
                  {PACK_UNIT_LABELS[u]}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label={unitsLabel}
            error={errors.unitsPerStrip}
            hint={unitsPerPackHint(values.unit)}
          >
            <Input
              value={values.unitsPerStrip}
              onChange={(e) => {
                if (isIntInput(e.target.value, 3))
                  setField("unitsPerStrip")(e.target.value);
              }}
              className={fieldClass}
              inputMode="numeric"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="MRP (₹) *" error={errors.mrp}>
            <Input
              value={values.mrp}
              onChange={(e) => {
                if (isMoneyInput(e.target.value))
                  setField("mrp")(e.target.value);
              }}
              className={fieldClass}
              inputMode="decimal"
            />
          </Field>
          <Field label="Sale (₹) *" error={errors.salePrice}>
            <Input
              value={values.salePrice}
              onChange={(e) => {
                if (isMoneyInput(e.target.value))
                  setField("salePrice")(e.target.value);
              }}
              className={fieldClass}
              inputMode="decimal"
            />
          </Field>
          <Field label="Min stock *" error={errors.minStock}>
            <Input
              value={values.minStock}
              onChange={(e) => {
                if (isIntInput(e.target.value, 6))
                  setField("minStock")(e.target.value);
              }}
              className={fieldClass}
              inputMode="numeric"
            />
          </Field>
          <Field label="GST % *" hint="Included in MRP">
            <select
              value={values.gstPercent}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (isGstRate(n)) setField("gstPercent")(n);
              }}
              className={fieldClass}
            >
              {GST_RATES.map((r) => (
                <option key={r} value={r}>
                  {r}%
                </option>
              ))}
            </select>
          </Field>
          <Field label="Schedule" hint="H / H1 / X need a prescription">
            <select
              value={values.schedule}
              onChange={(e) =>
                setField("schedule")(e.target.value as DrugSchedule)
              }
              className={fieldClass}
            >
              {DRUG_SCHEDULES.map((sc) => (
                <option key={sc} value={sc}>
                  {SCHEDULE_LABELS[sc]}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex items-end pb-1">
            {(values.unit === "STP" || values.unit === "LSE") && (
              <label className="flex items-center gap-2 text-[12px] text-foreground cursor-pointer h-9">
                <input
                  type="checkbox"
                  checked={values.allowLoose}
                  onChange={(e) => setField("allowLoose")(e.target.checked)}
                  className="rounded border-border"
                />
                Allow loose (LSE) sale
              </label>
            )}
          </div>
        </div>

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
            {isEdit ? "Save changes" : "Add medicine"}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}
