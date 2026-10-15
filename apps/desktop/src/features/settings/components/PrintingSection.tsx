import { PrinterSettings } from "@/features/printing/PrinterSettings";
import { WhatsAppSettings } from "@/features/whatsapp/WhatsAppSettings";
import { SettingsCard } from "./SettingsCard";

/** Printers and WhatsApp of THIS computer (each counter keeps its own) */
export function PrintingSection() {
  return (
    <div className="space-y-3">
      <SettingsCard
        title="Printing (this computer)"
        description="Bill paper size and printer for this computer — each counter can use a different printer. Also on every bill: the Printer button."
      >
        <PrinterSettings />
      </SettingsCard>
      <SettingsCard
        title="WhatsApp (this computer)"
        description="How bills, orders and refill reminders open in WhatsApp."
      >
        <WhatsAppSettings />
      </SettingsCard>
    </div>
  );
}
