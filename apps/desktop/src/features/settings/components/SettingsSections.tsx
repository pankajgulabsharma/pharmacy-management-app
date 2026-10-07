import { useId, useState } from "react";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Monitor, Moon, RotateCcw, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { FormField } from "@/components/common/FormField";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { fieldClass, invalidFieldClass } from "@/components/common/formStyles";
import {
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
} from "@medicare/domain/billing/types";
import { checkGstin, toGstinInput } from "@medicare/domain/lib/gstin";
import { useSettingsStore } from "../store/useSettingsStore";
import { useSectionForm } from "../hooks/useSectionForm";
import {
  SETTINGS_LIMITS as L,
  type InventoryPrefs,
  type ShopProfile,
} from "@medicare/domain/settings/types";
import {
  validateInventory,
  validateShop,
} from "@medicare/domain/settings/validation";
import { SettingsCard } from "./SettingsCard";
import { EditableList } from "./EditableList";

/* ------------------------------------------------------------------ */
/* Shop profile                                                       */
/* ------------------------------------------------------------------ */

export function ShopProfileSection() {
  const id = useId();
  const saved = useSettingsStore((s) => s.shop);
  const updateShop = useSettingsStore((s) => s.updateShop);
  const f = useSectionForm<ShopProfile>(saved, validateShop);
  const gst = f.draft.gstin.length === 15 ? checkGstin(f.draft.gstin) : null;
  const cls = (k: keyof ShopProfile) =>
    cn(fieldClass, f.errors[k] && invalidFieldClass);

  return (
    <SettingsCard
      title="Shop profile"
      description="Printed at the top of every bill. GSTIN and drug licence are legally required on pharmacy invoices."
      dirty={f.dirty}
      onDiscard={f.discard}
      onSubmit={() => {
        if (f.submit(updateShop)) toast.success("Shop profile saved");
        else toast.error("Please fix the highlighted fields");
      }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField
          label="Shop name *"
          htmlFor={`${id}-name`}
          error={f.errors.name}
        >
          <Input
            id={`${id}-name`}
            value={f.draft.name}
            maxLength={L.shopNameMax}
            onChange={(e) => f.set("name", e.target.value)}
            aria-invalid={Boolean(f.errors.name)}
            className={cls("name")}
          />
        </FormField>
        <FormField
          label="Phone *"
          htmlFor={`${id}-phone`}
          error={f.errors.phone}
        >
          <Input
            id={`${id}-phone`}
            type="tel"
            value={f.draft.phone}
            maxLength={16}
            onChange={(e) =>
              f.set("phone", e.target.value.replace(/[^\d+\s-]/g, ""))
            }
            aria-invalid={Boolean(f.errors.phone)}
            className={cn(cls("phone"), "tabular-nums")}
          />
        </FormField>
        <FormField
          label="Address *"
          htmlFor={`${id}-address`}
          error={f.errors.address}
          className="sm:col-span-2"
        >
          <Input
            id={`${id}-address`}
            value={f.draft.address}
            maxLength={L.addressMax}
            onChange={(e) => f.set("address", e.target.value)}
            aria-invalid={Boolean(f.errors.address)}
            className={cls("address")}
          />
        </FormField>
        <FormField
          label="GSTIN"
          htmlFor={`${id}-gstin`}
          error={f.errors.gstin}
          hint={
            gst?.ok ? `✓ ${gst.stateName}` : "Leave empty if not GST-registered"
          }
        >
          <Input
            id={`${id}-gstin`}
            value={f.draft.gstin}
            onChange={(e) => f.set("gstin", toGstinInput(e.target.value))}
            aria-invalid={Boolean(f.errors.gstin)}
            className={cn(cls("gstin"), "font-mono uppercase")}
            spellCheck={false}
          />
        </FormField>
        <FormField label="Email" htmlFor={`${id}-email`} error={f.errors.email}>
          <Input
            id={`${id}-email`}
            type="email"
            value={f.draft.email}
            maxLength={L.emailMax}
            onChange={(e) => f.set("email", e.target.value)}
            aria-invalid={Boolean(f.errors.email)}
            className={cls("email")}
          />
        </FormField>
        <FormField
          label="Drug licence no(s). *"
          htmlFor={`${id}-dl`}
          error={f.errors.drugLicense}
          hint="Retail licences, e.g. 20B / 21B numbers"
          className="sm:col-span-2"
        >
          <Input
            id={`${id}-dl`}
            value={f.draft.drugLicense}
            maxLength={L.licenseMax}
            onChange={(e) => f.set("drugLicense", e.target.value.toUpperCase())}
            aria-invalid={Boolean(f.errors.drugLicense)}
            className={cn(cls("drugLicense"), "font-mono")}
          />
        </FormField>
      </div>
    </SettingsCard>
  );
}

/* ------------------------------------------------------------------ */
/* Billing                                                            */
/* ------------------------------------------------------------------ */

type BillingDraft = {
  defaultCounter: string;
  defaultPaymentMethod: PaymentMethod;
  receiptFooter: string;
};
const noErrors = () => ({});

export function BillingSection() {
  const id = useId();
  const saved = useSettingsStore((s) => s.billing);
  const counters = useSettingsStore((s) => s.counters);
  const updateBilling = useSettingsStore((s) => s.updateBilling);
  const f = useSectionForm<BillingDraft>(saved, noErrors);

  return (
    <SettingsCard
      title="Billing"
      description="Defaults used every time a new bill is started, and the note printed at the bottom of bills."
      dirty={f.dirty}
      onDiscard={f.discard}
      onSubmit={() =>
        f.submit(updateBilling) && toast.success("Billing settings saved")
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField
          label="Default counter"
          htmlFor={`${id}-counter`}
          hint="Manage counters under Doctors & counters"
        >
          <select
            id={`${id}-counter`}
            value={f.draft.defaultCounter}
            onChange={(e) => f.set("defaultCounter", e.target.value)}
            className={fieldClass}
          >
            {counters.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </FormField>
        <div className="space-y-1">
          <span className="block text-[11px] font-medium text-foreground">
            Default payment method
          </span>
          <div
            className="grid grid-cols-3 gap-1 p-0.5"
            role="radiogroup"
            aria-label="Default payment method"
          >
            {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map(
              (m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={f.draft.defaultPaymentMethod === m}
                  onClick={() => f.set("defaultPaymentMethod", m)}
                  className={cn(
                    "h-8 rounded-md border text-[11px] font-medium",
                    f.draft.defaultPaymentMethod === m
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-muted",
                  )}
                >
                  {PAYMENT_METHOD_LABELS[m]}
                </button>
              ),
            )}
          </div>
        </div>
        <FormField
          label="Bill footer note"
          htmlFor={`${id}-footer`}
          hint={`${f.draft.receiptFooter.length}/${L.footerMax} · printed at the bottom of every bill`}
          className="sm:col-span-2"
        >
          <textarea
            id={`${id}-footer`}
            value={f.draft.receiptFooter}
            maxLength={L.footerMax}
            rows={2}
            onChange={(e) => f.set("receiptFooter", e.target.value)}
            className={cn(fieldClass, "h-auto py-2 resize-none")}
          />
        </FormField>
      </div>
    </SettingsCard>
  );
}

/* ------------------------------------------------------------------ */
/* Inventory                                                          */
/* ------------------------------------------------------------------ */

const DAY_PRESETS = [30, 60, 90, 180] as const;

export function InventorySection() {
  const id = useId();
  const saved = useSettingsStore((s) => s.inventory);
  const updateInventory = useSettingsStore((s) => s.updateInventory);
  const f = useSectionForm<InventoryPrefs>(saved, validateInventory);
  const num = (v: string) =>
    v === "" ? 0 : Number(v.replace(/\D/g, "").slice(0, 3));

  return (
    <SettingsCard
      title="Stock & expiry"
      description="When batches start showing as “Expiring soon” in Inventory, Medicines and on bills."
      dirty={f.dirty}
      onDiscard={f.discard}
      onSubmit={() => {
        if (f.submit(updateInventory)) toast.success("Stock settings saved");
        else toast.error("Please fix the highlighted fields");
      }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField
          label="“Expiring soon” window (days)"
          htmlFor={`${id}-days`}
          error={f.errors.expiringSoonDays}
          hint={`${L.expiringDays.min}–${L.expiringDays.max} days`}
        >
          <div className="flex gap-1.5">
            <Input
              id={`${id}-days`}
              inputMode="numeric"
              value={f.draft.expiringSoonDays || ""}
              onChange={(e) => f.set("expiringSoonDays", num(e.target.value))}
              aria-invalid={Boolean(f.errors.expiringSoonDays)}
              className={cn(
                fieldClass,
                "w-24 tabular-nums",
                f.errors.expiringSoonDays && invalidFieldClass,
              )}
            />
            {DAY_PRESETS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => f.set("expiringSoonDays", d)}
                className={cn(
                  "h-9 px-2.5 rounded-lg border text-[11px]",
                  f.draft.expiringSoonDays === d
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-muted",
                )}
              >
                {d}
              </button>
            ))}
          </div>
        </FormField>
        <FormField
          label="Short-expiry warning on purchase (months)"
          htmlFor={`${id}-months`}
          error={f.errors.purchaseShortExpiryMonths}
          hint="Purchase lines expiring sooner than this get a warning"
        >
          <Input
            id={`${id}-months`}
            inputMode="numeric"
            value={f.draft.purchaseShortExpiryMonths || ""}
            onChange={(e) =>
              f.set("purchaseShortExpiryMonths", num(e.target.value))
            }
            aria-invalid={Boolean(f.errors.purchaseShortExpiryMonths)}
            className={cn(
              fieldClass,
              "w-24 tabular-nums",
              f.errors.purchaseShortExpiryMonths && invalidFieldClass,
            )}
          />
        </FormField>
      </div>
    </SettingsCard>
  );
}

/* ------------------------------------------------------------------ */
/* Doctors & counters (saved immediately)                              */
/* ------------------------------------------------------------------ */

export function ListsSection() {
  const doctors = useSettingsStore((s) => s.doctors);
  const counters = useSettingsStore((s) => s.counters);
  const setDoctors = useSettingsStore((s) => s.setDoctors);
  const setCounters = useSettingsStore((s) => s.setCounters);

  return (
    <SettingsCard
      title="Doctors & counters"
      description="Pick-lists on the billing screen. Changes are saved immediately."
    >
      <EditableList
        label="Doctors"
        items={doctors}
        onChange={setDoctors}
        placeholder="e.g. Dr. Kavita Shah, MBBS"
        maxItems={L.maxDoctors}
        maxLength={L.doctorMax}
      />
      <div className="border-t border-border pt-3">
        <EditableList
          label="Billing counters"
          items={counters}
          onChange={setCounters}
          placeholder="e.g. Counter 4"
          maxItems={L.maxCounters}
          maxLength={L.counterMax}
          minItems={1}
        />
      </div>
    </SettingsCard>
  );
}

/* ------------------------------------------------------------------ */
/* Appearance                                                         */
/* ------------------------------------------------------------------ */

const THEMES = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "Same as computer", icon: Monitor },
] as const;

const LANGUAGES = [
  { id: "en", label: "English" },
  { id: "hi", label: "हिन्दी" },
] as const;

export function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const { i18n } = useTranslation();
  const lang = i18n.language?.startsWith("hi") ? "hi" : "en";

  return (
    <SettingsCard
      title="Appearance"
      description="Theme and language for this computer."
    >
      <div className="space-y-1">
        <span className="block text-[11px] font-medium">Theme</span>
        <div
          className="flex flex-wrap gap-2"
          role="radiogroup"
          aria-label="Theme"
        >
          {THEMES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={theme === id}
              onClick={() => setTheme(id)}
              className={cn(
                "h-9 px-3 rounded-lg border text-[12px] inline-flex items-center gap-1.5",
                theme === id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-muted",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1">
        <span className="block text-[11px] font-medium">Language</span>
        <div className="flex gap-2" role="radiogroup" aria-label="Language">
          {LANGUAGES.map((l) => (
            <button
              key={l.id}
              type="button"
              role="radio"
              aria-checked={lang === l.id}
              onClick={() => i18n.changeLanguage(l.id)}
              className={cn(
                "h-9 px-3 rounded-lg border text-[12px]",
                lang === l.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-muted",
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>
    </SettingsCard>
  );
}

/* ------------------------------------------------------------------ */
/* Data                                                               */
/* ------------------------------------------------------------------ */

export function DataSection() {
  const resetToDefaults = useSettingsStore((s) => s.resetToDefaults);
  const [confirm, setConfirm] = useState(false);

  return (
    <SettingsCard
      title="Data"
      description="What is stored where while the app runs on demo data."
    >
      <ul className="space-y-1.5 text-[11px] text-muted-foreground list-disc pl-4">
        <li>
          <b className="text-foreground">Settings</b> (this page) are remembered
          on this computer.
        </li>
        <li>
          <b className="text-foreground">
            Medicines, stock, purchases and bills
          </b>{" "}
          are demo data kept in memory — a page refresh starts fresh. They will
          be saved in the database once the backend is connected.
        </li>
      </ul>
      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          onClick={() => window.location.reload()}
          className="h-8 rounded-lg text-[11px] gap-1.5"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Restart with fresh demo data
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setConfirm(true)}
          className="h-8 rounded-lg text-[11px] text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
        >
          Reset all settings to defaults
        </Button>
      </div>
      <ConfirmDialog
        open={confirm}
        title="Reset all settings?"
        description="Shop profile, billing defaults, expiry windows, doctors and counters go back to their original values."
        confirmLabel="Reset settings"
        onConfirm={() => {
          resetToDefaults();
          setConfirm(false);
          toast.success("Settings reset to defaults");
        }}
        onClose={() => setConfirm(false)}
      />
    </SettingsCard>
  );
}
