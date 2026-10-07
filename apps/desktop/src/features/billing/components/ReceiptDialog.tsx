import { useEffect, useId } from "react";
import { Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalShell } from "@/components/common/ModalShell";
import {
  formatPaise,
  inrFromPaise,
  signedInrFromPaise,
} from "@medicare/domain/lib/money";
import { useSettingsStore } from "@/features/settings/store/useSettingsStore";
import {
  PAYMENT_METHOD_LABELS,
  type Sale,
} from "@medicare/domain/billing/types";

type Props = {
  sale: Sale | null;
  /** Open the print dialog as soon as the bill is shown */
  autoPrint: boolean;
  onClose: () => void;
  /** Reprint from search: "Bill INV-0042" instead of "… saved" */
  reprint?: boolean;
};

/** Printable tax invoice (fits an 80 mm thermal roll; prints fine on A4) */
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

  useEffect(() => {
    if (!autoPrint) return;
    // Let the receipt render before the browser print dialog opens
    const id = window.setTimeout(() => window.print(), 150);
    return () => window.clearTimeout(id);
  }, [autoPrint]);

  const t = sale.totals;
  const p = sale.payment;
  const when = new Date(sale.createdAt).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <ModalShell
      open
      onClose={onClose}
      labelledBy={titleId}
      className="max-w-sm max-h-[92vh] flex flex-col overflow-hidden"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5 shrink-0 print:hidden">
        <h2 id={titleId} className="text-sm font-semibold">
          Bill {sale.billNo}
          {reprint ? "" : " saved"}
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

      <div className="flex-1 min-h-0 overflow-auto p-3">
        <div className="print-area mx-auto bg-white text-black rounded-md border border-border p-3 font-mono text-[10px] leading-snug">
          <div className="text-center">
            <p className="text-[13px] font-bold">{shop.name}</p>
            <p>{shop.address}</p>
            <p>Ph {shop.phone}</p>
            {shop.gstin ? <p>GSTIN {shop.gstin}</p> : null}
            <p>DL {shop.drugLicense}</p>
            <p className="mt-1 font-bold">TAX INVOICE</p>
          </div>

          <Rule />
          <Kv k="Bill" v={sale.billNo} />
          <Kv k="Date" v={when} />
          <Kv k="Customer" v={sale.customerName} />
          {sale.doctor ? <Kv k="Doctor" v={sale.doctor} /> : null}
          {sale.counter ? <Kv k="Counter" v={sale.counter} /> : null}
          {sale.billedBy ? <Kv k="Billed by" v={sale.billedBy} /> : null}
          <Rule />

          <table className="w-full">
            <thead>
              <tr className="text-left">
                <th className="font-bold">Item</th>
                <th className="text-right font-bold">Qty</th>
                <th className="text-right font-bold">Amt</th>
              </tr>
            </thead>
            <tbody>
              {sale.lines.map((l) => (
                <tr key={l.id} className="align-top">
                  <td className="pr-1 pt-1">
                    {l.medicineName}
                    <div className="text-[9px]">
                      {l.allocations
                        .map((a) => `${a.batchNo} ${a.expiry}`)
                        .join(", ")}{" "}
                      · GST {l.gstPercent}%
                      {l.discountPercent ? ` · ${l.discountPercent}% off` : ""}
                    </div>
                  </td>
                  <td className="text-right pt-1 whitespace-nowrap">
                    {[
                      l.qtyStrip ? `${l.qtyStrip}${l.unit}` : "",
                      l.qtyLoose ? `${l.qtyLoose}L` : "",
                    ]
                      .filter(Boolean)
                      .join("+")}
                  </td>
                  <td className="text-right pt-1">
                    {formatPaise(l.amountPaise)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <Rule />
          <Kv k="Subtotal" v={formatPaise(t.grossPaise)} />
          {t.discountPaise ? (
            <Kv k="Discount" v={`-${formatPaise(t.discountPaise)}`} />
          ) : null}
          <Kv k="Taxable value" v={formatPaise(t.taxablePaise)} />
          <Kv k="CGST" v={formatPaise(t.cgstPaise)} />
          <Kv k="SGST" v={formatPaise(t.sgstPaise)} />
          {t.roundOffPaise ? (
            <Kv k="Round off" v={signedInrFromPaise(t.roundOffPaise)} />
          ) : null}
          <div className="flex justify-between text-[13px] font-bold mt-1">
            <span>TOTAL</span>
            <span>{inrFromPaise(t.netPaise)}</span>
          </div>
          <p className="text-[9px]">(Prices include GST)</p>

          <Rule />
          <Kv k="Paid by" v={PAYMENT_METHOD_LABELS[p.method]} />
          {p.method === "cash" ? (
            <>
              <Kv k="Received" v={formatPaise(p.receivedPaise)} />
              <Kv k="Change" v={formatPaise(p.changePaise)} />
            </>
          ) : null}
          {p.split ? (
            <Kv
              k="Split"
              v={`C ${formatPaise(p.split.cashPaise)} / U ${formatPaise(p.split.upiPaise)} / Cd ${formatPaise(p.split.cardPaise)}`}
            />
          ) : null}
          {p.reference ? <Kv k="Ref" v={p.reference} /> : null}
          <Rule />
          {footer ? (
            <p className="text-center whitespace-pre-line">{footer}</p>
          ) : null}
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-border px-4 py-2.5 shrink-0 print:hidden">
        <Button
          type="button"
          variant="outline"
          className="h-8 rounded-lg text-[11px]"
          onClick={onClose}
        >
          New bill
        </Button>
        <Button
          type="button"
          className="h-8 rounded-lg text-[11px] gap-1.5"
          onClick={() => window.print()}
          data-autofocus
        >
          <Printer className="h-3.5 w-3.5" />
          Print
        </Button>
      </div>
    </ModalShell>
  );
}

function Rule() {
  return <div className="my-1.5 border-t border-dashed border-black/60" />;
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span>{k}</span>
      <span className="text-right">{v}</span>
    </div>
  );
}
