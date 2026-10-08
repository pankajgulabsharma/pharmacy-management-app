import { PrinterSettings } from "@/features/printing/PrinterSettings";
import { SettingsCard } from "./SettingsCard";

/** Printers of THIS computer (each counter keeps its own) */
export function PrintingSection() {
  return (
    <SettingsCard
      title="Printing (this computer)"
      description="Bill paper size and printer for this computer — each counter can use a different printer. Also on every bill: the Printer button."
    >
      <PrinterSettings />
    </SettingsCard>
  );
}
