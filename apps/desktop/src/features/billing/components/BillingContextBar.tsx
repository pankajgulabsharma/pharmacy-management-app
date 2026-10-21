import type { Customer } from "@medicare/domain/customers/types";
import { CustomerNameInput } from "./CustomerNameInput";
import { DoctorPicker } from "./DoctorPicker";
import { useTranslation } from "react-i18next";
import { toGstinInput } from "@medicare/domain/lib/gstin";
import {
  UserRound,
  UserPlus,
  Stethoscope,
  MonitorSmartphone,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/common/Kbd";
import { KEYS } from "@/app/shortcuts/registry";
import { cn } from "@/lib/utils";
import { tr } from "@/lib/i18n";

type Props = {
  customerName: string;
  onCustomerChange: (v: string) => void;
  /** F3 focuses this */
  customerRef?: React.Ref<HTMLInputElement>;
  onClearCustomer: () => void;
  /** A register drug (H1 / X / NDPS) is on the bill → patient's address */
  needsPatientAddress: boolean;
  patientAddress: string;
  onPatientAddressChange: (v: string) => void;
  /** Saved customer the bill is linked to (null = typed name only) */
  customerId: string | null;
  onPickCustomer: (c: Customer) => void;
  /** Linked to a saved customer → their mobile + address are shown here */
  linked: boolean;
  customerPhone: string;
  onCustomerPhoneChange: (v: string) => void;
  /** Mobile / address can't be saved to the customer (e.g. 9 digits) */
  customerError: string | null;
  /** Typed name isn't a saved customer → offer to save one (optional) */
  onSaveCustomer: () => void;
  prescribedBy: string;
  onPrescribedByChange: (v: string) => void;
  counter: string;
  onCounterChange: (v: string) => void;
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
  customerId,
  onPickCustomer,
  needsPatientAddress,
  patientAddress,
  onPatientAddressChange,
  linked,
  customerPhone,
  onCustomerPhoneChange,
  customerError,
  onSaveCustomer,
  prescribedBy,
  onPrescribedByChange,
  counter,
  onCounterChange,
  counters,
  gstin,
  onGstinChange,
  canB2b,
}: Props) {
  const { t } = useTranslation();
  const showGstin = canB2b && gstin !== null;
  const offerSave = !linked && customerName.trim().length >= 2;

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
          <CustomerNameInput
            inputRef={customerRef}
            value={customerName}
            customerId={customerId}
            onChange={onCustomerChange}
            onPick={onPickCustomer}
            className={cn(fieldStyle, "pl-3 pr-8")}
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
        {/* A new name → saving them as a customer is optional */}
        {offerSave ? (
          <button
            type="button"
            onClick={onSaveCustomer}
            title={tr(
              "Optional — keeps their mobile, address and udhaar for next time",
            )}
            className="-mt-1 self-start inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 hover:underline dark:text-emerald-400"
          >
            <UserPlus className="h-3 w-3" />
            {tr("Save as customer (optional)")}
            <Kbd keys={KEYS.saveCustomer} className="ml-1" />
          </button>
        ) : null}
        {/* Saved customer: mobile + address from their account — a change
            here is saved to the account with the bill */}
        {linked || needsPatientAddress ? (
          <div className={cn(linked && "grid grid-cols-[120px_1fr] gap-2")}>
            {linked ? (
              <Input
                value={customerPhone}
                onChange={(e) =>
                  onCustomerPhoneChange(
                    e.target.value.replace(/[^\d+ ]/g, "").slice(0, 15),
                  )
                }
                inputMode="tel"
                placeholder={tr("Mobile")}
                aria-label={tr("Customer's mobile")}
                aria-invalid={!!customerError}
                className={cn(
                  fieldStyle,
                  "pl-3 tabular-nums",
                  customerError && "border-red-500/60",
                )}
                autoComplete="off"
              />
            ) : null}
            <Input
              value={patientAddress}
              onChange={(e) =>
                onPatientAddressChange(e.target.value.slice(0, 160))
              }
              placeholder={
                needsPatientAddress
                  ? tr("Patient's address (for the H1 / NDPS register)")
                  : tr("Address")
              }
              aria-label={tr("Patient's address")}
              className={cn(
                fieldStyle,
                "pl-3",
                needsPatientAddress &&
                  !patientAddress.trim() &&
                  "border-red-500/30 bg-red-500/[0.03]",
              )}
              autoComplete="off"
            />
          </div>
        ) : null}
        {linked ? (
          <p
            className={cn(
              "-mt-1 text-[10px]",
              customerError ? "text-red-600" : "text-muted-foreground",
            )}
          >
            {customerError
              ? tr(customerError)
              : tr("Changes here are saved to the customer's account")}
          </p>
        ) : null}
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
        {/* Pick a saved doctor, or type one not in the list (like a new
            prescription from another clinic) — saved lists in Settings */}
        <DoctorPicker
          value={prescribedBy}
          onChange={onPrescribedByChange}
          label={t("billing.prescribedBy")}
          placeholder={t("billing.selectDoctor")}
          className={fieldStyle}
        />
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
