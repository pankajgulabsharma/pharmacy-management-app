import { useId, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Ban,
  ClipboardList,
  MessageCircle,
  PackageCheck,
  Pencil,
  Printer,
  Truck,
} from "lucide-react";
import {
  canEditOrder,
  isOrderOpen,
  orderHtml,
  orderMessage,
  orderValuePaise,
  ORDER_STATUS_META,
  pendingQty,
  shortLines,
  type PurchaseOrder,
} from "@medicare/domain/purchases/orders";
import { inrFromPaise } from "@medicare/domain/lib/money";
import { whatsappNumber } from "@medicare/domain/printing/whatsapp";
import { ModalShell } from "@/components/common/ModalShell";
import { DialogCloseButton } from "@/components/common/DialogCloseButton";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { useCan } from "@/features/auth/store/useAuthStore";
import { useSettingsStore } from "@/features/settings/store/useSettingsStore";
import { useSupplierStore } from "@/features/suppliers/store/useSupplierStore";
import { useOpenWhatsApp } from "@/features/whatsapp/useWhatsApp";
import { printHtml } from "@/lib/print";
import { tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { rateText } from "./format";
import { useOrderStore } from "./useOrderStore";

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";

/** One order: what was asked, what came, what is short — and what to do */
export function OrderDetailsDialog({
  order: o,
  onClose,
  onEdit,
}: {
  order: PurchaseOrder;
  onClose: () => void;
  onEdit: (o: PurchaseOrder) => void;
}) {
  const titleId = useId();
  const navigate = useNavigate();
  const canAct = useCan("purchases");
  const act = useOrderStore((s) => s.act);
  const shop = useSettingsStore((s) => s.shop);
  const supplier = useSupplierStore((s) =>
    s.suppliers.find((x) => x.id === o.supplierId),
  );
  const openWhatsApp = useOpenWhatsApp();
  const [confirm, setConfirm] = useState<"close" | "cancel" | null>(null);
  const meta = ORDER_STATUS_META[o.status];
  const open = isOrderOpen(o);
  const short = shortLines(o);

  const run = async (what: "sent" | "close" | "cancel", ok?: string) => {
    try {
      await act(o.id, what);
      if (ok) toast.success(ok);
      setConfirm(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr("Could not save"));
    }
  };
  const markSent = () => {
    if (o.status === "open" && canAct) void run("sent");
  };
  const sendWhatsApp = () => {
    const phone =
      supplier && whatsappNumber(supplier.phone) ? supplier.phone : null;
    openWhatsApp(phone, orderMessage(o, shop));
    markSent();
  };
  const print = () => {
    printHtml({
      html: orderHtml(o, shop, {
        gstin: supplier?.gstin,
        address: supplier
          ? [supplier.address, supplier.city].filter(Boolean).join(", ")
          : "",
        phone: supplier?.phone,
      }),
    }).catch((e: Error) => toast.error(e.message));
    markSent();
  };

  return (
    <ModalShell
      open
      onClose={onClose}
      labelledBy={titleId}
      className="flex max-h-[90vh] max-w-3xl flex-col overflow-hidden"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ClipboardList className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-sm font-semibold">
              {tr("Purchase order")}{" "}
              <span className="font-mono">{o.orderNo}</span>
            </h2>
            <p className="truncate text-[10.5px] text-muted-foreground">
              {o.supplierName}
              {supplier?.phone ? ` · ${supplier.phone}` : ""}
            </p>
          </div>
          <StatusBadge tone={meta.tone} className="ml-1">
            {tr(meta.label)}
          </StatusBadge>
        </div>
        <DialogCloseButton onClick={onClose} />
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-2 border-b border-border px-4 py-2.5 text-[11px] sm:grid-cols-4">
        <Meta
          label={tr("Made")}
          value={`${when(o.createdAt)} · ${o.createdBy}`}
        />
        <Meta
          label={tr("Sent")}
          value={o.sentAt ? when(o.sentAt) : tr("Not yet")}
        />
        <Meta
          label={tr("Bills received")}
          value={
            o.receipts.length
              ? o.receipts.map((r) => r.invoiceNo).join(", ")
              : "—"
          }
        />
        <Meta
          label={tr("Approx. value")}
          value={inrFromPaise(orderValuePaise(o.lines))}
        />
      </div>
      {o.notes ? (
        <p className="shrink-0 border-b border-border px-4 py-2 text-[11px]">
          <span className="text-muted-foreground">{tr("Note")}: </span>
          {o.notes}
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto px-4 py-2">
        <table className="w-full text-[11.5px]">
          <thead className="text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr className="border-b border-border">
              <th className="py-1.5 text-left font-medium">{tr("Medicine")}</th>
              <th className="w-24 px-2 text-right font-medium">
                {tr("Ordered")}
              </th>
              <th className="w-24 px-2 text-right font-medium">
                {tr("Received")}
              </th>
              <th className="w-24 px-2 text-right font-medium">
                {o.receipts.length ? tr("Short") : tr("To come")}
              </th>
              <th className="w-24 text-right font-medium">{tr("Rate")}</th>
            </tr>
          </thead>
          <tbody>
            {o.lines.map((l) => {
              const left = pendingQty(l);
              return (
                <tr key={l.id} className="border-b border-border/60">
                  <td className="py-1.5">
                    <p className="font-medium">{l.medicineName}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {l.brand}
                    </p>
                  </td>
                  <td className="px-2 text-right tabular-nums">
                    {l.qty} {l.unit}
                  </td>
                  <td className="px-2 text-right tabular-nums">
                    {l.receivedQty ? `${l.receivedQty} ${l.unit}` : "—"}
                  </td>
                  <td
                    className={cn(
                      "px-2 text-right tabular-nums",
                      left && o.receipts.length
                        ? "font-medium text-rose-600 dark:text-rose-400"
                        : "text-muted-foreground",
                    )}
                  >
                    {left ? `${left} ${l.unit}` : "—"}
                  </td>
                  <td className="text-right tabular-nums text-muted-foreground">
                    {rateText(l.ratePaise)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={sendWhatsApp}
            className="h-8 gap-1 text-[11px]"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {tr("WhatsApp")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={print}
            className="h-8 gap-1 text-[11px]"
          >
            <Printer className="h-3.5 w-3.5" />
            {tr("Print")}
          </Button>
          {canAct && o.status === "open" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void run("sent", tr("Marked as sent"))}
              className="h-8 gap-1 text-[11px]"
            >
              <Truck className="h-3.5 w-3.5" />
              {tr("Mark sent")}
            </Button>
          ) : null}
          {canAct && canEditOrder(o) ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(o)}
              className="h-8 gap-1 text-[11px]"
            >
              <Pencil className="h-3.5 w-3.5" />
              {tr("Change")}
            </Button>
          ) : null}
        </div>
        {canAct && open ? (
          <div className="flex flex-wrap gap-2">
            {o.receipts.length ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirm("close")}
                className="h-8 text-[11px]"
              >
                {tr("Close — rest won't come")}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirm("cancel")}
                className="h-8 gap-1 text-[11px] text-rose-600 hover:text-rose-700"
              >
                <Ban className="h-3.5 w-3.5" />
                {tr("Cancel order")}
              </Button>
            )}
            <Button
              size="sm"
              onClick={() =>
                navigate(`/purchases?receive=${encodeURIComponent(o.id)}`)
              }
              className="h-8 gap-1 text-[11px]"
            >
              <PackageCheck className="h-3.5 w-3.5" />
              {o.receipts.length ? tr("Receive the rest") : tr("Receive goods")}
            </Button>
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirm === "close"}
        tone="default"
        title={tr("Close {{no}}?", { no: o.orderNo })}
        description={tr(
          "{{n}} medicines stay short — they'll show on the next “What to order” if still needed.",
          { n: short.length },
        )}
        confirmLabel={tr("Close order")}
        onConfirm={() => void run("close", tr("Order closed"))}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "cancel"}
        title={tr("Cancel {{no}}?", { no: o.orderNo })}
        description={tr("Tell the supplier too, if it was already sent.")}
        confirmLabel={tr("Cancel order")}
        onConfirm={() => void run("cancel", tr("Order cancelled"))}
        onClose={() => setConfirm(null)}
      />
    </ModalShell>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="truncate font-medium">{value}</p>
    </div>
  );
}
