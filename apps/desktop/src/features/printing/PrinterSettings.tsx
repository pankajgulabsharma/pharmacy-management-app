import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import {
  PAPER_FORMATS,
  receiptHtml,
  type PaperFormat,
} from "@medicare/domain/printing/receipt";
import { LABEL_SIZES, type LabelSize } from "@medicare/domain/printing/labels";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/common/FormField";
import { fieldClass } from "@/components/common/formStyles";
import { desktopBridge } from "@/lib/desktop";
import { printHtml } from "@/lib/print";
import { tr } from "@/lib/i18n";
import { useSettingsStore } from "@/features/settings/store/useSettingsStore";
import { usePrintPrefs } from "./usePrintPrefs";
import { sampleSale } from "./sample";

/**
 * Printer choices for this computer: bill paper size, printer (installed
 * app: prints straight away, no dialog), copies — and the label printer.
 */
export function PrinterSettings() {
  const id = useId();
  const prefs = usePrintPrefs();
  const shop = useSettingsStore((s) => s.shop);
  const footer = useSettingsStore((s) => s.billing.receiptFooter);
  const bridge = desktopBridge();
  const [printers, setPrinters] = useState<string[]>([]);

  useEffect(() => {
    bridge
      ?.listPrinters()
      .then((list) => setPrinters(list.map((p) => p.name)))
      .catch(() => setPrinters([]));
  }, [bridge]);

  const testPrint = () =>
    printHtml({
      html: receiptHtml({
        sale: sampleSale(),
        shop,
        footer,
        format: prefs.format,
      }),
      widthMm: PAPER_FORMATS[prefs.format].widthMm,
      printer: prefs.printer,
    }).catch((e: Error) => toast.error(e.message));

  const printerSelect = (
    value: string,
    onChange: (v: string) => void,
    label: string,
  ) =>
    bridge ? (
      <FormField
        label={label}
        htmlFor={`${id}-${label}`}
        hint={
          value
            ? "Prints straight away — no dialog"
            : "Asks every time (print dialog)"
        }
      >
        <select
          id={`${id}-${label}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={fieldClass}
        >
          <option value="">{tr("Ask every time")}</option>
          {printers.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </FormField>
    ) : null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField
          label="Bill paper"
          htmlFor={`${id}-fmt`}
          hint={PAPER_FORMATS[prefs.format].hint}
        >
          <select
            id={`${id}-fmt`}
            value={prefs.format}
            onChange={(e) =>
              prefs.set({ format: e.target.value as PaperFormat })
            }
            className={fieldClass}
          >
            {(Object.keys(PAPER_FORMATS) as PaperFormat[]).map((f) => (
              <option key={f} value={f}>
                {tr(PAPER_FORMATS[f].label)}
              </option>
            ))}
          </select>
        </FormField>
        {printerSelect(
          prefs.printer,
          (printer) => prefs.set({ printer }),
          "Bill printer",
        )}
        {bridge ? (
          <FormField label="Copies" htmlFor={`${id}-copies`}>
            <select
              id={`${id}-copies`}
              value={prefs.copies}
              onChange={(e) => prefs.set({ copies: Number(e.target.value) })}
              className={fieldClass}
            >
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </FormField>
        ) : null}
        <FormField
          label="Barcode labels"
          htmlFor={`${id}-lbl`}
          hint={LABEL_SIZES[prefs.labelSize].hint}
        >
          <select
            id={`${id}-lbl`}
            value={prefs.labelSize}
            onChange={(e) =>
              prefs.set({ labelSize: e.target.value as LabelSize })
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
        {printerSelect(
          prefs.labelPrinter,
          (labelPrinter) => prefs.set({ labelPrinter }),
          "Label printer",
        )}
      </div>
      {!bridge ? (
        <p className="text-[11px] text-muted-foreground">
          {tr(
            "In the browser the print dialog opens every time — choose the printer there. The installed app can print straight to a chosen printer.",
          )}
        </p>
      ) : null}
      <Button
        type="button"
        variant="outline"
        onClick={testPrint}
        className="h-8 rounded-lg text-[11px]"
      >
        {tr("Print a test bill")}
      </Button>
    </div>
  );
}
