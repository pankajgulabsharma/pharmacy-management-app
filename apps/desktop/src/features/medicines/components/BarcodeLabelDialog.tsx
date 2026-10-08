import { useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { Barcode, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalShell } from "@/components/common/ModalShell";
import { FormField } from "@/components/common/FormField";
import { fieldClass } from "@/components/common/formStyles";
import { cn } from "@/lib/utils";
import { tr } from "@/lib/i18n";
import { printHtml } from "@/lib/print";
import { formatRupees } from "@medicare/domain/lib/money";
import {
  LABEL_SIZES,
  labelsHtml,
  newInStoreBarcode,
  type LabelSize,
} from "@medicare/domain/printing/labels";
import type { Medicine } from "@medicare/domain/medicines/types";
import { useCan } from "@/features/auth/store/useAuthStore";
import { useSettingsStore } from "@/features/settings/store/useSettingsStore";
import { usePrintPrefs } from "@/features/printing/usePrintPrefs";
import { barcodeSvg } from "@/features/printing/barcode";
import { useMedicineStore } from "../store/useMedicineStore";

const MAX_LABELS = 500;

/** Barcode stickers for one medicine (label printer roll or A4 sticker sheet) */
export function BarcodeLabelDialog({
  medicineId,
  onClose,
}: {
  medicineId: string | null;
  onClose: () => void;
}) {
  const m = useMedicineStore((s) =>
    medicineId ? s.medicines.find((x) => x.id === medicineId) : undefined,
  );
  if (!m) return null;
  return <Labels key={m.id} medicine={m} onClose={onClose} />;
}

function Labels({
  medicine: m,
  onClose,
}: {
  medicine: Medicine;
  onClose: () => void;
}) {
  const id = useId();
  const shopName = useSettingsStore((s) => s.shop.name);
  const { labelSize, labelPrinter, set } = usePrintPrefs();
  const canEdit = useCan("stock");
  const [count, setCount] = useState("1");
  const [busy, setBusy] = useState(false);
  const n = Math.min(Math.max(parseInt(count, 10) || 0, 0), MAX_LABELS);
  const size = LABEL_SIZES[labelSize];

  const item = useMemo(
    () =>
      m.barcode
        ? {
            name: m.name,
            price: `MRP Rs ${formatRupees(m.mrp)}`,
            barcodeSvg: barcodeSvg(m.barcode),
            extra: m.rack ? `Rack ${m.rack}` : undefined,
          }
        : null,
    [m],
  );
  const preview = useMemo(
    () => (item ? labelsHtml([item], labelSize, shopName) : ""),
    [item, labelSize, shopName],
  );

  const generate = async () => {
    setBusy(true);
    try {
      const { id: medId, ...input } = m;
      const taken = new Set(
        useMedicineStore
          .getState()
          .medicines.map((x) => x.barcode)
          .filter(Boolean),
      );
      await useMedicineStore
        .getState()
        .updateMedicine(medId, { ...input, barcode: newInStoreBarcode(taken) });
      toast.success(tr("Barcode created and saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const print = () => {
    if (!item || n < 1) return;
    printHtml({
      html: labelsHtml(Array(n).fill(item), labelSize, shopName),
      ...(size.sheet ? {} : { widthMm: size.w, heightMm: size.h }),
      printer: labelPrinter,
    }).then(onClose, (e: Error) => toast.error(e.message));
  };

  return (
    <ModalShell
      open
      onClose={onClose}
      labelledBy={`${id}-t`}
      className="max-w-md"
    >
      <div className="p-4 space-y-3">
        <h2
          id={`${id}-t`}
          className="text-sm font-semibold inline-flex items-center gap-2"
        >
          <Barcode className="h-4 w-4 text-primary" />
          {tr("Barcode labels")} — {m.name}
        </h2>
        {!item ? (
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-[12px] space-y-2">
            <p>
              {tr(
                "This medicine has no barcode yet. Most packs already have one — scan it into the medicine's Barcode field. For loose stock or own packs, make a shop barcode:",
              )}
            </p>
            {canEdit ? (
              <Button
                type="button"
                disabled={busy}
                onClick={generate}
                className="h-8 rounded-lg text-[11px]"
              >
                {tr("Create barcode")}
              </Button>
            ) : (
              <p className="text-muted-foreground">
                {tr("Ask the pharmacist or owner to add one.")}
              </p>
            )}
          </div>
        ) : (
          <>
            <iframe
              title={tr("Label preview")}
              srcDoc={preview}
              sandbox=""
              className="mx-auto block bg-white rounded border border-border"
              style={{
                width: `${size.w * 3.78 + 2}px`,
                height: `${size.h * 3.78 + 2}px`,
              }}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="How many"
                htmlFor={`${id}-n`}
                hint={`1–${MAX_LABELS}`}
              >
                <input
                  id={`${id}-n`}
                  data-autofocus
                  inputMode="numeric"
                  value={count}
                  onChange={(e) =>
                    setCount(e.target.value.replace(/\D/g, "").slice(0, 3))
                  }
                  className={fieldClass}
                />
              </FormField>
              <FormField label="Label size" htmlFor={`${id}-s`}>
                <select
                  id={`${id}-s`}
                  value={labelSize}
                  onChange={(e) =>
                    set({ labelSize: e.target.value as LabelSize })
                  }
                  className={fieldClass}
                >
                  {(Object.keys(LABEL_SIZES) as LabelSize[]).map((s) => (
                    <option key={s} value={s}>
                      {tr(LABEL_SIZES[s].label)}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
            <p className="text-[11px] text-muted-foreground">{tr(size.hint)}</p>
          </>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="h-8 rounded-lg text-[11px]"
          >
            {tr("Close")}
          </Button>
          {item ? (
            <Button
              type="button"
              data-primary
              disabled={n < 1}
              onClick={print}
              className={cn("h-8 rounded-lg text-[11px] gap-1.5")}
            >
              <Printer className="h-3.5 w-3.5" />
              {tr("Print {{n}} labels", { n })}
            </Button>
          ) : null}
        </div>
      </div>
    </ModalShell>
  );
}
