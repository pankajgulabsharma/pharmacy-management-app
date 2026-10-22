import { useId } from "react";
import { toast } from "sonner";
import {
  LOYALTY_LIMITS as L,
  type LoyaltySettings,
} from "@medicare/domain/customers/loyalty";
import { inrFromPaise } from "@medicare/domain/lib/money";
import { FormField } from "@/components/common/FormField";
import { fieldClass } from "@/components/common/formStyles";
import { tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useSectionForm } from "../hooks/useSectionForm";
import { useSettingsStore } from "../store/useSettingsStore";
import { SettingsCard } from "./SettingsCard";

const noErrors = () => ({});
/** What one point can be worth (paise) */
const POINT_VALUES = [10, 25, 50, 100, 200, 500];
const num = (v: string, min: number, max: number) =>
  Math.min(max, Math.max(min, Number(v.replace(/\D/g, "")) || min));

/**
 * Settings → Billing → Loyalty points: on / off and the four numbers.
 * Points go to saved customers only; the example shows what it means.
 */
export function LoyaltyCard() {
  const id = useId();
  const saved = useSettingsStore((s) => s.loyalty);
  const update = useSettingsStore((s) => s.updateLoyalty);
  const f = useSectionForm<LoyaltySettings>(saved, noErrors);
  const d = f.draft;
  // A ₹1,000 bill, as an example
  const earn = Math.floor((1000_00 * d.pointsPer100) / 100_00);
  const backPct = ((d.pointsPer100 * d.pointValuePaise) / 100).toFixed(
    d.pointsPer100 * d.pointValuePaise >= 100 ? 0 : 1,
  );

  const field = (
    key: "pointsPer100" | "minRedeem" | "maxRedeemPercent",
    label: string,
    hint: string,
    lim: { min: number; max: number },
  ) => (
    <FormField label={label} htmlFor={`${id}-${key}`} hint={hint}>
      <input
        id={`${id}-${key}`}
        inputMode="numeric"
        disabled={!d.enabled}
        value={String(d[key])}
        onChange={(e) => f.set(key, num(e.target.value, lim.min, lim.max))}
        className={cn(fieldClass, "w-32 tabular-nums")}
      />
    </FormField>
  );

  return (
    <SettingsCard
      title="Loyalty points"
      description="Saved customers earn points on every bill and use them on a later one. Off unless you switch it on."
      dirty={f.dirty}
      onDiscard={f.discard}
      onSubmit={() =>
        f.submit(update).then(
          () => toast.success(tr("Loyalty settings saved")),
          (e: Error) => toast.error(e.message),
        )
      }
    >
      <label className="flex items-center gap-2 text-[12px] font-medium">
        <input
          type="checkbox"
          checked={d.enabled}
          onChange={(e) => f.set("enabled", e.target.checked)}
          className="h-4 w-4 accent-[var(--primary)]"
        />
        {tr("Give loyalty points to saved customers")}
      </label>
      <div
        className={cn(
          "grid grid-cols-1 gap-3 sm:grid-cols-2",
          !d.enabled && "opacity-60",
        )}
      >
        {field(
          "pointsPer100",
          "Points for every ₹100",
          "Earned on what the customer pays (after points used)",
          L.pointsPer100,
        )}
        <FormField
          label="One point is worth"
          htmlFor={`${id}-value`}
          hint="Value of a point when it is used on a bill"
        >
          <select
            id={`${id}-value`}
            disabled={!d.enabled}
            value={d.pointValuePaise}
            onChange={(e) => f.set("pointValuePaise", Number(e.target.value))}
            className={cn(fieldClass, "w-32")}
          >
            {POINT_VALUES.map((p) => (
              <option key={p} value={p}>
                {inrFromPaise(p)}
              </option>
            ))}
          </select>
        </FormField>
        {field(
          "minRedeem",
          "Use from (points)",
          "Fewest points that can be used at once",
          L.minRedeem,
        )}
        {field(
          "maxRedeemPercent",
          "Points can pay up to (% of a bill)",
          "The rest is paid in money",
          L.maxRedeemPercent,
        )}
      </div>
      {d.enabled ? (
        <p className="rounded-lg bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
          {tr(
            "Example: a ₹1,000 bill earns {{earn}} points, worth {{worth}} on a later bill — about {{pct}}% back.",
            {
              earn,
              worth: inrFromPaise(earn * d.pointValuePaise),
              pct: backPct,
            },
          )}
        </p>
      ) : null}
    </SettingsCard>
  );
}
