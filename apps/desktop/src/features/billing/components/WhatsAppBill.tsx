import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import type { Sale } from "@medicare/domain/billing/types";
import { billMessage } from "@medicare/domain/printing/whatsapp";
import { useOpenWhatsApp } from "@/features/whatsapp/useWhatsApp";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/components/common/formStyles";
import { cn } from "@/lib/utils";
import { tr } from "@/lib/i18n";
import { useCustomerStore } from "@/features/customers/store/useCustomerStore";
import { useSettingsStore } from "@/features/settings/store/useSettingsStore";

/**
 * "WhatsApp" strip on a saved bill: confirm the customer's mobile → WhatsApp
 * opens with the bill written out. Free — nothing is sent by us.
 */
export function WhatsAppBill({
  sale,
  onDone,
}: {
  sale: Sale;
  onDone: () => void;
}) {
  const shop = useSettingsStore((s) => s.shop);
  const footer = useSettingsStore((s) => s.billing.receiptFooter);
  // The linked customer's saved mobile; else a saved customer with
  // exactly this name (only if there is just one)
  const known = useCustomerStore((s) => {
    const byId = s.customers.find((c) => c.id === sale.customerId);
    if (byId) return byId.phone;
    const name = sale.customerName.trim().toLowerCase();
    const same = s.customers.filter(
      (c) => c.phone && c.name.trim().toLowerCase() === name,
    );
    return same.length === 1 ? same[0].phone : "";
  });
  const [phone, setPhone] = useState(known);
  const openWhatsApp = useOpenWhatsApp();

  // Empty mobile = choose the chat in WhatsApp
  const send = () => {
    if (!openWhatsApp(phone, billMessage(sale, shop, footer))) {
      toast.error(tr("Enter a 10-digit mobile number"));
      return;
    }
    onDone();
  };

  return (
    <div className="flex items-center gap-2 border-t border-border bg-[#25D366]/10 px-4 py-2 shrink-0">
      <span className="h-7 w-7 shrink-0 rounded-full bg-[#25D366] text-white flex items-center justify-center">
        <MessageCircle className="h-4 w-4 fill-white/25" strokeWidth={2.2} />
      </span>
      <input
        autoFocus
        inputMode="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value.slice(0, 15))}
        onKeyDown={(e) => {
          if (e.key === "Enter") send();
          if (e.key === "Escape") {
            e.stopPropagation();
            onDone();
          }
        }}
        placeholder={tr("Customer mobile (empty = choose chat)")}
        aria-label={tr("Customer mobile")}
        className={cn(fieldClass, "h-8 flex-1")}
      />
      <Button
        type="button"
        className="h-8 rounded-full px-4 text-[11px] font-semibold gap-1 bg-[#25D366] text-white hover:bg-[#1ebe5b]"
        onClick={send}
      >
        {tr("Send")}
      </Button>
    </div>
  );
}
