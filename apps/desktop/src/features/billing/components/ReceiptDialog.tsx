import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { Printer, Settings2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalShell } from "@/components/common/ModalShell";
import { fieldClass } from "@/components/common/formStyles";
import { cn } from "@/lib/utils";
import { tr } from "@/lib/i18n";
import { printHtml } from "@/lib/print";
import type { Sale } from "@medicare/domain/billing/types";
import {
  PAPER_FORMATS,
  isThermal,
  receiptHtml,
  type PaperFormat,
} from "@medicare/domain/printing/receipt";
import { useSettingsStore } from "@/features/settings/store/useSettingsStore";
import { usePrintPrefs } from "@/features/printing/usePrintPrefs";
import { PrinterSettings } from "@/features/printing/PrinterSettings";

type Props = {
  sale: Sale | null;
  /** Print as soon as the bill is shown (Save and Print) */
  autoPrint: boolean;
  onClose: () => void;
  /** Reprint from search: "Bill INV-0042" instead of "… saved" */
  reprint?: boolean;
};

/**
 * The bill: an exact preview of the page that prints, in the paper size
 * chosen for this computer (thermal 58/80 mm, A5, A4).
 */
export function ReceiptDialog({ sale, ...rest }: Props) {
  if (!sale) return null;
  return <Receipt key={sale.id} sale={sale} {...rest} />;
}

function Receipt({
  sale,
  autoPrint,
  onClose,
  reprint = false,
}: Omit<Props, "sale"> & { sale: Sale }) {
  const titleId = useId();
  const shop = useSettingsStore((s) => s.shop);
  const footer = useSettingsStore((s) => s.billing.receiptFooter);
  const { format, printer, copies, set } = usePrintPrefs();
  const [setup, setSetup] = useState(false);
  const html = useMemo(
    () => receiptHtml({ sale, shop, footer, format }),
    [sale, shop, footer, format],
  );

  const print = useCallback(
    () =>
      printHtml({
        html,
        widthMm: PAPER_FORMATS[format].widthMm,
        printer,
        copies,
      }).catch((e: Error) => toast.error(e.message)),
    [html, format, printer, copies],
  );

  // Save and Print: print once, as soon as the bill is ready
  const printed = useRef(false);
  useEffect(() => {
    if (!autoPrint || printed.current) return;
    printed.current = true;
    void print();
  }, [autoPrint, print]);

  const thermal = isThermal(format);

  return (
    <ModalShell
      open
      onClose={onClose}
      labelledBy={titleId}
      className={cn(
        "max-h-[92vh] flex flex-col overflow-hidden",
        thermal ? "max-w-sm" : "max-w-3xl",
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5 shrink-0">
        <h2 id={titleId} className="text-sm font-semibold">
          {tr("Bill")} {sale.billNo}
          {reprint ? "" : ` ${tr("saved")}`}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto bg-muted/40 p-3">
        {setup ? (
          <PrinterSettings />
        ) : (
          <iframe
            title={`Bill ${sale.billNo}`}
            srcDoc={html}
            // Preview only: no scripts, nothing can run inside
            sandbox=""
            className={cn(
              "mx-auto block bg-white rounded-md border border-border shadow-sm",
              thermal ? "w-[320px] h-[60vh]" : "w-full h-[65vh]",
            )}
          />
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <select
            aria-label={tr("Bill paper")}
            value={format}
            onChange={(e) => set({ format: e.target.value as PaperFormat })}
            className={cn(fieldClass, "h-8 w-44")}
          >
            {(Object.keys(PAPER_FORMATS) as PaperFormat[]).map((f) => (
              <option key={f} value={f}>
                {tr(PAPER_FORMATS[f].label)}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="ghost"
            className="h-8 rounded-lg text-[11px] gap-1"
            onClick={() => setSetup((v) => !v)}
          >
            <Settings2 className="h-3.5 w-3.5" />
            {tr(setup ? "Back to bill" : "Printer")}
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-8 rounded-lg text-[11px]"
            onClick={onClose}
          >
            {tr(reprint ? "Close" : "New bill")}
          </Button>
          <Button
            type="button"
            className="h-8 rounded-lg text-[11px] gap-1.5"
            onClick={print}
            data-autofocus
          >
            <Printer className="h-3.5 w-3.5" />
            {tr("Print")}
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}
