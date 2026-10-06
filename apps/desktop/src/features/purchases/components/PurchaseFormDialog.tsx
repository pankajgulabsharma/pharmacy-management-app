import {
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { toast } from "sonner";
import { Truck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ModalShell } from "@/components/common/ModalShell";
import { FormField } from "@/components/common/FormField";
import { DateInput } from "@/components/common/DateInput";
import { fieldClass, invalidFieldClass } from "@/components/common/formStyles";
import { toCodeInput } from "@medicare/domain/lib/sanitize";
import { toISODate } from "@medicare/domain/lib/date";
import { formatPaise } from "@medicare/domain/lib/money";
import type { Medicine, MedicineWithStock } from "@medicare/domain/medicines/types";
import {
  PURCHASE_LIMITS,
  type Purchase,
  type PurchaseDraft,
  type PurchaseHeaderField,
  type Supplier,
} from "@medicare/domain/purchases/types";
import { calcTotals } from "@medicare/domain/purchases/calc";
import {
  draftToEditedPurchase,
  purchaseToDraft,
  createEmptyDraft,
  createLineFromMedicine,
  draftLineToAmountInput,
  draftToPurchase,
  getDueDate,
  isDraftDirty,
} from "@medicare/domain/purchases/draft";
import {
  NO_ERRORS,
  hasErrors,
  validatePurchaseDraft,
} from "@medicare/domain/purchases/validation";
import { MedicinePicker } from "./MedicinePicker";
import {
  PurchaseLinesEditor,
  type LineChangeHandler,
} from "./PurchaseLinesEditor";
import { PurchaseTotalsPanel } from "./PurchaseTotalsPanel";

type Props = {
  open: boolean;
  suppliers: readonly Supplier[];
  medicines: readonly MedicineWithStock[];
  existingPurchases: readonly Purchase[];
  /** When set, the form edits this invoice instead of creating a new one */
  editing?: Purchase | null;
  onClose: () => void;
  /** Return false if saving failed, so the form can be submitted again */
  onSave: (purchase: Purchase, mode: "create" | "edit") => boolean;
};

/**
 * Mounts the form only while open (keyed by the invoice being edited), so
 * every open starts from a fresh draft — no reset effects needed.
 */
export function PurchaseFormDialog({ open, editing = null, ...rest }: Props) {
  if (!open) return null;
  return (
    <PurchaseForm key={editing?.id ?? "new"} editing={editing} {...rest} />
  );
}

function PurchaseForm({
  suppliers: allSuppliers,
  medicines,
  existingPurchases,
  editing = null,
  onClose,
  onSave,
}: Omit<Props, "open">) {
  const titleId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const linesRef = useRef<HTMLDivElement>(null);
  const savingRef = useRef(false);

  const [today] = useState(() => new Date());
  // Snapshot of the starting point — used to detect unsaved changes
  const [initial] = useState<PurchaseDraft>(() =>
    editing ? purchaseToDraft(editing) : createEmptyDraft(today),
  );
  const [draft, setDraft] = useState<PurchaseDraft>(initial);
  const isEdit = editing !== null;

  // Only active suppliers can be chosen (the edited invoice's own supplier stays available)
  const suppliers = useMemo(
    () =>
      allSuppliers.filter(
        (s) => s.status === "active" || s.id === editing?.supplierId,
      ),
    [allSuppliers, editing?.supplierId],
  );
  const [showErrors, setShowErrors] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  /* ---------------- derived ---------------- */

  const supplier = useMemo(
    () => suppliers.find((s) => s.id === draft.supplierId) ?? null,
    [suppliers, draft.supplierId],
  );

  const totals = useMemo(
    () => calcTotals(draft.lines.map(draftLineToAmountInput)),
    [draft.lines],
  );

  const dueDate = supplier
    ? getDueDate(draft.invoiceDate, supplier.creditDays)
    : "";

  // Validate live only after the first save attempt (no red on a fresh form)
  const errors = useMemo(
    () =>
      showErrors
        ? validatePurchaseDraft(draft, {
            suppliers,
            existing: existingPurchases,
            today,
            netPaise: totals.netPaise,
            editing,
          })
        : NO_ERRORS,
    [
      showErrors,
      draft,
      suppliers,
      existingPurchases,
      today,
      totals.netPaise,
      editing,
    ],
  );

  /* ---------------- handlers (stable) ---------------- */

  const setHeader = useCallback(
    <K extends PurchaseHeaderField>(field: K, value: PurchaseDraft[K]) => {
      setDraft((d) => ({ ...d, [field]: value }));
      setConfirmDiscard(false);
    },
    [],
  );

  const addLine = useCallback((m: Medicine) => {
    const line = createLineFromMedicine(m);
    setDraft((d) =>
      d.lines.length >= PURCHASE_LIMITS.maxLines
        ? d
        : { ...d, lines: [...d.lines, line] },
    );
    setConfirmDiscard(false);
    // Jump straight to the new row's batch field
    requestAnimationFrame(() => {
      linesRef.current
        ?.querySelector<HTMLInputElement>(
          `[data-line="${line.key}"][data-field="batchNo"]`,
        )
        ?.focus();
    });
  }, []);

  const updateLine = useCallback<LineChangeHandler>((key, field, value) => {
    setDraft((d) => ({
      ...d,
      lines: d.lines.map((l) => (l.key === key ? { ...l, [field]: value } : l)),
    }));
  }, []);

  const removeLine = useCallback((key: string) => {
    setDraft((d) => ({ ...d, lines: d.lines.filter((l) => l.key !== key) }));
  }, []);

  const onPaidChange = useCallback(
    (value: string) => setHeader("paid", value),
    [setHeader],
  );

  const requestClose = useCallback(() => {
    const dirty = isEdit
      ? JSON.stringify(draft) !== JSON.stringify(initial)
      : isDraftDirty(draft);
    if (dirty && !confirmDiscard) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  }, [draft, initial, isEdit, confirmDiscard, onClose]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (savingRef.current) return; // guard against double submit

    const result = validatePurchaseDraft(draft, {
      suppliers,
      existing: existingPurchases,
      today,
      netPaise: totals.netPaise,
      editing,
    });
    setShowErrors(true);

    if (hasErrors(result) || !supplier) {
      toast.error("Please fix the highlighted fields");
      requestAnimationFrame(() => {
        formRef.current
          ?.querySelector<HTMLElement>('[aria-invalid="true"]')
          ?.focus();
      });
      return;
    }

    savingRef.current = true;
    const now = new Date();
    const saved = editing
      ? onSave(draftToEditedPurchase(draft, supplier, editing, now), "edit")
      : onSave(draftToPurchase(draft, supplier, now), "create");
    if (!saved) savingRef.current = false;
  };

  const onFormKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    // Ctrl/Cmd + S saves
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  const h = errors.header;

  return (
    <ModalShell
      open
      onClose={requestClose}
      labelledBy={titleId}
      className="max-w-6xl h-[92vh] flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Truck className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 id={titleId} className="text-sm font-semibold">
              {editing
                ? `Edit purchase · ${editing.invoiceNo}`
                : "New purchase"}
            </h2>
            <p className="text-[10px] text-muted-foreground truncate">
              {editing
                ? `Revision ${editing.revision} → ${editing.revision + 1} · stock will be re-posted · Ctrl + S to save`
                : "Enter the supplier's invoice · Ctrl + S to save"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={requestClose}
          aria-label="Close"
          className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <form
        ref={formRef}
        onSubmit={handleSubmit}
        onKeyDown={onFormKeyDown}
        noValidate
        className="flex-1 min-h-0 flex flex-col"
      >
        {/* Invoice details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 px-4 pt-3 shrink-0">
          <FormField
            label="Supplier *"
            htmlFor="purchase-supplier"
            error={h.supplierId}
            hint={
              supplier
                ? `GSTIN ${supplier.gstin} · ${supplier.city}`
                : undefined
            }
            className="lg:col-span-2"
          >
            <select
              id="purchase-supplier"
              data-autofocus
              value={draft.supplierId}
              onChange={(e) => setHeader("supplierId", e.target.value)}
              aria-invalid={Boolean(h.supplierId)}
              className={cn(fieldClass, h.supplierId && invalidFieldClass)}
            >
              <option value="">Select supplier…</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            label="Supplier invoice no. *"
            htmlFor="purchase-invoice-no"
            error={h.invoiceNo}
          >
            <Input
              id="purchase-invoice-no"
              value={draft.invoiceNo}
              onChange={(e) =>
                setHeader(
                  "invoiceNo",
                  toCodeInput(e.target.value, PURCHASE_LIMITS.invoiceNoMax),
                )
              }
              placeholder="e.g. SGP/26-27/1184"
              aria-invalid={Boolean(h.invoiceNo)}
              className={cn(
                fieldClass,
                "font-mono",
                h.invoiceNo && invalidFieldClass,
              )}
              autoComplete="off"
              spellCheck={false}
            />
          </FormField>

          <FormField
            label="Invoice date *"
            htmlFor="purchase-invoice-date"
            error={h.invoiceDate}
          >
            <DateInput
              id="purchase-invoice-date"
              value={draft.invoiceDate}
              max={toISODate(today)}
              onChange={(e) => setHeader("invoiceDate", e.target.value)}
              aria-invalid={Boolean(h.invoiceDate)}
              className={cn(fieldClass, h.invoiceDate && invalidFieldClass)}
            />
          </FormField>
        </div>

        {/* Item search */}
        <div className="px-4 pt-3 shrink-0">
          <MedicinePicker medicines={medicines} onPick={addLine} />
          {h.lines ? (
            <p className="mt-1 text-[10px] text-red-500" role="alert">
              {h.lines}
            </p>
          ) : null}
        </div>

        {/* Items */}
        <div ref={linesRef} className="flex-1 min-h-0 flex flex-col px-4 pt-3">
          <PurchaseLinesEditor
            lines={draft.lines}
            errors={errors.lines}
            today={today}
            onChange={updateLine}
            onRemove={removeLine}
          />
        </div>

        {/* Notes + totals */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_240px_280px] items-start gap-3 px-4 pt-3 shrink-0">
          <FormField
            label="Notes"
            htmlFor="purchase-notes"
            hint="Visible only inside the app"
          >
            <textarea
              id="purchase-notes"
              value={draft.notes}
              onChange={(e) => setHeader("notes", e.target.value)}
              maxLength={PURCHASE_LIMITS.notesMax}
              rows={4}
              placeholder="e.g. 2 strips damaged, credit note promised"
              className={cn(fieldClass, "h-auto py-2 resize-none")}
            />
          </FormField>

          <PurchaseTotalsPanel
            totals={totals}
            paid={draft.paid}
            paidError={h.paid}
            dueDate={dueDate}
            creditDays={supplier?.creditDays ?? null}
            onPaidChange={onPaidChange}
            lockedPaidPaise={editing ? editing.paidPaise : undefined}
            returnedPaise={editing?.returnedPaise ?? 0}
          />
        </div>

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-border px-4 py-3 shrink-0">
          {confirmDiscard ? (
            <p
              className="text-[11px] text-orange-600 dark:text-orange-400"
              role="alert"
            >
              {isEdit
                ? "Discard your changes? The invoice stays as it was."
                : "Discard this purchase? Everything entered will be lost."}
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              {isEdit
                ? "Stock will be re-posted as"
                : "Stock will be added for"}{" "}
              {totals.totalQty + totals.totalFreeQty} packs
            </p>
          )}

          <div className="flex items-center gap-2 shrink-0">
            {confirmDiscard ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded-lg text-[12px]"
                  onClick={() => setConfirmDiscard(false)}
                >
                  Keep editing
                </Button>
                <Button
                  type="button"
                  className="h-9 rounded-lg text-[12px] bg-red-600 text-white hover:bg-red-700"
                  onClick={onClose}
                >
                  Discard
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded-lg text-[12px]"
                  onClick={requestClose}
                >
                  Cancel
                </Button>
                <Button type="submit" className="h-9 rounded-lg text-[12px]">
                  {isEdit ? "Save changes" : "Save purchase"}
                  {totals.netPaise > 0
                    ? ` · ₹${formatPaise(totals.netPaise)}`
                    : ""}
                </Button>
              </>
            )}
          </div>
        </div>
      </form>
    </ModalShell>
  );
}
