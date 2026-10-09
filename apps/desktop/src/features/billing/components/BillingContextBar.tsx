import { useTranslation } from "react-i18next";
import { toGstinInput } from "@medicare/domain/lib/gstin";
import { UserRound, Stethoscope, MonitorSmartphone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { tr } from "@/lib/i18n";

type Props = {
  customerName: string;
  onCustomerChange: (v: string) => void;
  /** F3 focuses this */
  customerRef?: React.Ref<HTMLInputElement>;
  onClearCustomer: () => void;
  prescribedBy: string;
  onPrescribedByChange: (v: string) => void;
  counter: string;
  onCounterChange: (v: string) => void;
  doctors: string[];
  counters: string[];
  /** B2B (GST) bill: buyer's GSTIN (null = normal bill, field closed) */
  gstin: string | null;
  onGstinChange: (v: string | null) => void;
  /** The shop has a GSTIN (Settings) — else no B2B bills */
  canB2b: boolean;
};

const fieldStyle = cn(
  "h-9 w-full rounded-lg !text-[11px] leading-none",
  "bg-muted/40 border border-border/50 shadow-none",
  "transition-colors",
  "placeholder:!text-[11px] placeholder:text-muted-foreground",
  "hover:border-border hover:bg-muted/50",
  "focus-visible:outline-none focus-visible:ring-1",
  "focus-visible:ring-ring focus-visible:border-border",
  "focus-visible:bg-background",
);

export function BillingContextBar({
  customerName,
  onCustomerChange,
  customerRef,
  onClearCustomer,
  prescribedBy,
  onPrescribedByChange,
  counter,
  onCounterChange,
  doctors,
  counters,
  gstin,
  onGstinChange,
  canB2b,
}: Props) {
  const { t } = useTranslation();
  const showGstin = canB2b && gstin !== null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 shrink-0 p-0.5">
      {/* Customer */}
      <div className="min-w-0 flex flex-col gap-2">
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
            <span className="h-5 w-5 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <UserRound className="h-3 w-3" />
            </span>
            {t("billing.customerName")}
          </label>
          {canB2b ? (
            <button
              type="button"
              onClick={() => onGstinChange(showGstin ? null : "")}
              className="ml-auto text-[10px] text-primary hover:underline"
            >
              {showGstin ? tr("Remove GSTIN") : tr("+ GSTIN (B2B bill)")}
            </button>
          ) : null}
        </div>
        <div className="relative">
          <Input
            ref={customerRef}
            value={customerName}
            placeholder={tr("Walk-in customer (F3)")}
            onChange={(e) => onCustomerChange(e.target.value)}
            className={cn(fieldStyle, "pl-3 pr-8")}
            autoComplete="off"
          />
          {customerName ? (
            <button
              type="button"
              onClick={onClearCustomer}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-sm"
              aria-label="Clear"
            >
              ×
            </button>
          ) : null}
        </div>
        {showGstin ? (
          <Input
            value={gstin ?? ""}
            onChange={(e) => onGstinChange(toGstinInput(e.target.value))}
            placeholder={tr("Buyer's GSTIN, e.g. 27AAPFU0939F1ZV")}
            aria-label={tr("Buyer's GSTIN")}
            className={cn(fieldStyle, "pl-3 font-mono uppercase")}
            autoComplete="off"
            autoFocus={gstin === ""}
          />
        ) : null}
      </div>

      {/* Prescribed By */}
      <div className="min-w-0 flex flex-col gap-2">
        <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
          <span className="h-5 w-5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Stethoscope className="h-3 w-3" />
          </span>
          {t("billing.prescribedBy")}
        </label>
        <select
          value={prescribedBy}
          onChange={(e) => onPrescribedByChange(e.target.value)}
          className={cn(fieldStyle, "px-3 text-foreground")}
        >
          <option value="">{t("billing.selectDoctor")}</option>
          {doctors.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      {/* Counter */}
      <div className="min-w-0 flex flex-col gap-2">
        <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
          <span className="h-5 w-5 rounded-md bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
            <MonitorSmartphone className="h-3 w-3" />
          </span>
          {t("billing.counter")}
        </label>
        <select
          value={counter}
          onChange={(e) => onCounterChange(e.target.value)}
          className={cn(fieldStyle, "px-3 text-foreground")}
        >
          {counters.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
