import { useMemo, useState } from "react";
import { Copy, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import {
  orderText,
  type OrderRow,
} from "@medicare/domain/reports/stockInsights";
import type { ShopProfile } from "@medicare/domain/settings/types";
import { whatsappNumber } from "@medicare/domain/printing/whatsapp";
import { ModalShell } from "@/components/common/ModalShell";
import { DialogCloseButton } from "@/components/common/DialogCloseButton";
import { WhatsAppPreview } from "@/components/common/WhatsAppPreview";
import { useSupplierStore } from "@/features/suppliers/store/useSupplierStore";
import { useOpenWhatsApp } from "@/features/whatsapp/useWhatsApp";
import { fieldClass } from "@/components/common/formStyles";
import { tr } from "@/lib/i18n";

/** "" = the whole list (choose the chat in WhatsApp) */
type Target = string;

/**
 * Send the order on WhatsApp: to one supplier (only the medicines last
 * bought from them, straight to their saved mobile), or the whole list
 * to any chat — a distributor's group, a salesman. Nothing to save in
 * the phone's contacts.
 */
export function OrderSendDialog({
  rows,
  shop,
  onClose,
}: {
  rows: readonly OrderRow[];
  shop: ShopProfile;
  onClose: () => void;
}) {
  const suppliers = useSupplierStore((s) => s.suppliers);
  const openWhatsApp = useOpenWhatsApp();
  const groups = useMemo(() => {
    const by = new Map<string, OrderRow[]>();
    for (const r of rows)
      if (r.lastSupplierId)
        by.set(r.lastSupplierId, [...(by.get(r.lastSupplierId) ?? []), r]);
    return [...by.entries()]
      .map(([id, list]) => ({
        id,
        name: list[0].lastSupplier,
        phone: suppliers.find((s) => s.id === id)?.phone ?? "",
        rows: list,
      }))
      .sort((a, b) => b.rows.length - a.rows.length);
  }, [rows, suppliers]);
  const [to, setTo] = useState<Target>(groups[0]?.id ?? "");
  const group = groups.find((g) => g.id === to) ?? null;
  const list = group ? group.rows : rows;
  const text = orderText(list, shop);
  const phone = group && whatsappNumber(group.phone) ? group.phone : null;

  const send = () => {
    openWhatsApp(phone, text);
    onClose();
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(tr("Order copied — paste it in WhatsApp"));
      onClose();
    } catch {
      toast.error(tr("Could not copy — use Export instead"));
    }
  };

  return (
    <ModalShell
      open
      onClose={onClose}
      labelledBy="order-send-title"
      className="max-w-lg"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 id="order-send-title" className="text-sm font-semibold">
          {tr("Send the order on WhatsApp")}
        </h2>
        <DialogCloseButton onClick={onClose} />
      </div>
      <div className="space-y-2 border-b border-border px-4 py-3 text-[11px]">
        <label className="block font-medium" htmlFor="order-to">
          {tr("Send to")}
        </label>
        <select
          id="order-to"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className={fieldClass}
        >
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name} —{" "}
              {g.rows.length === 1
                ? tr("1 item")
                : `${g.rows.length} ${tr("items")}`}
              {g.phone ? ` · ${g.phone}` : ""}
            </option>
          ))}
          <option value="">
            {tr("Whole list ({{n}} items) — choose the chat in WhatsApp", {
              n: rows.length,
            })}
          </option>
        </select>
        <p className="text-muted-foreground">
          {phone
            ? tr(
                "Opens the chat with {{name}} ({{phone}}) — just press Send.",
                {
                  name: group!.name,
                  phone: group!.phone,
                },
              )
            : group
              ? tr(
                  "No mobile saved for this supplier — WhatsApp asks which chat. Add it in Suppliers to skip this.",
                )
              : tr(
                  "WhatsApp asks which chat — a distributor, a salesman or a group.",
                )}
        </p>
      </div>
      <div className="max-h-[50vh] overflow-y-auto p-3">
        <WhatsAppPreview text={text} />
      </div>
      <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-[12px] font-medium hover:bg-muted"
        >
          <Copy className="h-3.5 w-3.5" />
          {tr("Copy")}
        </button>
        <button
          type="button"
          onClick={send}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#25D366] px-4 text-[12px] font-semibold text-white hover:bg-[#1fb857]"
        >
          <MessageCircle className="h-4 w-4" />
          {tr("Open in WhatsApp")}
        </button>
      </div>
    </ModalShell>
  );
}
