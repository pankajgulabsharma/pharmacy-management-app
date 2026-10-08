import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import type { Sale } from "@medicare/domain/billing/types";
import {
  billMessage,
  whatsappLink,
  whatsappNumber,
} from "@medicare/domain/printing/whatsapp";
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
  const shopName = useSettingsStore((s) => s.shop.name);
  const footer = useSettingsStore((s) => s.billing.receiptFooter);
  const known = useCustomerStore(
    (s) => s.customers.find((c) => c.id === sale.customerId)?.phone ?? "",
  );
  const [phone, setPhone] = useState(known);

  const send = () => {
    const n = whatsappNumber(phone);
    if (!n) {
      toast.error(tr("Enter a 10-digit mobile number"));
      return;
    }
    window.open(whatsappLink(n, billMessage(sale, shopName, footer)), "_blank");
    onDone();
  };

  return (
    <div className="flex items-center gap-2 border-t border-border bg-emerald-50/60 dark:bg-emerald-950/20 px-4 py-2 shrink-0">
      <MessageCircle className="h-4 w-4 text-emerald-600 shrink-0" />
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
        placeholder={tr("Customer mobile")}
        aria-label={tr("Customer mobile")}
        className={cn(fieldClass, "h-8 flex-1")}
      />
      <Button
        type="button"
        className="h-8 rounded-lg text-[11px] gap-1 bg-emerald-600 hover:bg-emerald-700"
        onClick={send}
      >
        {tr("Send")}
      </Button>
    </div>
  );
}
