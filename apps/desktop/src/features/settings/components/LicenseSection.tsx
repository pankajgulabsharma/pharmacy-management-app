import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, KeyRound, LifeBuoy, Lock } from "lucide-react";
import {
  FEATURE_LABEL,
  PLAN_FEATURES,
  PLAN_LABEL,
  type Plan,
} from "@medicare/domain/license/plan";
import { VENDOR } from "@medicare/domain/vendor";
import { SupportDialog } from "@/features/support/SupportDialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/StatusBadge";
import { fieldClass } from "@/components/common/formStyles";
import { cn } from "@/lib/utils";
import { tr } from "@/lib/i18n";
import {
  useLicenseStore,
  type LicenseState,
} from "@/features/license/useLicenseStore";
import { SettingsCard } from "./SettingsCard";

const STATUS: Record<
  LicenseState["status"],
  { label: string; tone: "success" | "warning" | "danger" | "neutral" | "info" }
> = {
  off: { label: "Not checked (development)", tone: "neutral" },
  trial: { label: "Free trial", tone: "info" },
  active: { label: "Active", tone: "success" },
  grace: { label: "Ended — grace days", tone: "warning" },
  expired: { label: "On hold", tone: "danger" },
  clock: { label: "On hold — wrong date", tone: "danger" },
};

/**
 * Owner: licence status, this computer's machine code (send it to the
 * provider) and the box to paste the new key into. Works while on hold.
 */
export function LicenseSection() {
  const state = useLicenseStore((s) => s.state);
  const load = useLicenseStore((s) => s.loadFromServer);
  const saveKey = useLicenseStore((s) => s.saveKey);
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [help, setHelp] = useState(false);

  useEffect(() => void load().catch(() => {}), [load]);

  // (No <form> here: this card is already a form — forms can't nest)
  const submit = async () => {
    if (!key.trim()) return;
    setSaving(true);
    try {
      const s = await saveKey(key.trim());
      setKey("");
      toast.success(
        tr("Licence saved — works until {{date}}", {
          date: s.license?.expiresAt ?? "",
        }),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  if (!state)
    return (
      <SettingsCard title="Licence" description="">
        <p className="text-[12px] text-muted-foreground">{tr("Loading…")}</p>
      </SettingsCard>
    );

  const st = STATUS[state.status];
  const l = state.license;
  return (
    <SettingsCard
      title="Licence"
      description="This shop's licence. When it ends, billing goes on hold until a new key is entered — your data always stays safe and viewable."
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={st.tone} shape="rounded">
          {st.label}
        </StatusBadge>
        {state.status === "off" ? (
          <span className="text-[12px] text-muted-foreground">
            {tr(
              "Development copy — licence is checked only in the installed app. To try it here, start the server with: npm run dev:server:license",
            )}
          </span>
        ) : null}
        {state.message ? (
          <span className="text-[12px] text-muted-foreground">
            {tr(state.message)}
          </span>
        ) : null}
      </div>

      <dl className="grid grid-cols-[140px_1fr] gap-y-1.5 text-[12px]">
        <dt className="text-muted-foreground">{tr("Machine code")}</dt>
        <dd className="flex items-center gap-2">
          <code className="text-[13px] font-semibold tracking-wide">
            {state.machine}
          </code>
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              navigator.clipboard
                ?.writeText(state.machine)
                .then(() => toast.success(tr("Copied")))
            }
            className="h-7 rounded-md text-[11px] gap-1"
          >
            <Copy className="h-3.5 w-3.5" />
            {tr("Copy")}
          </Button>
        </dd>
        {l ? (
          <>
            <dt className="text-muted-foreground">{tr("Licensed to")}</dt>
            <dd>{l.shop}</dd>
            <dt className="text-muted-foreground">
              {tr("AMC / renewal till")}
            </dt>
            <dd>{l.expiresAt}</dd>
            <dt className="text-muted-foreground">{tr("Computers")}</dt>
            <dd>{l.counters}</dd>
            <dt className="text-muted-foreground">{tr("Licence no.")}</dt>
            <dd className="font-mono">{l.id}</dd>
          </>
        ) : null}
      </dl>
      <PlanCard plan={state.plan} />
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2">
        <p className="text-[11px] text-muted-foreground">
          {tr(
            "To buy, renew the AMC or upgrade: send the machine code to {{company}}. They send back a licence key — paste it below.",
            { company: VENDOR.company },
          )}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => setHelp(true)}
          className="h-8 rounded-lg text-[11px] gap-1.5"
        >
          <LifeBuoy className="h-3.5 w-3.5" />
          {tr("Contact support")}
        </Button>
      </div>
      {help ? <SupportDialog onClose={() => setHelp(false)} /> : null}

      <div className="space-y-2">
        <textarea
          value={key}
          onChange={(e) => setKey(e.target.value)}
          rows={3}
          spellCheck={false}
          placeholder="MC1.…"
          aria-label={tr("Licence key")}
          className={cn(
            fieldClass,
            "h-auto py-2 font-mono text-[11px] break-all",
          )}
        />
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={() => void submit()}
            disabled={saving || !key.trim()}
            className="h-8 rounded-lg text-[11px] gap-1.5"
          >
            <KeyRound className="h-3.5 w-3.5" />
            {tr("Save licence key")}
          </Button>
        </div>
      </div>
    </SettingsCard>
  );
}

/** Both plans side by side — what this shop has, what the other adds */
function PlanCard({ plan }: { plan: Plan }) {
  const plans: Plan[] = ["single", "multi"];
  const base = [
    "Billing, stock & GST",
    "Udhaar, reports, backups",
    "Doctor referrals",
  ];
  const extra: Record<Plan, string[]> = {
    single: ["1 billing computer"],
    multi: [
      "Several billing counters",
      ...PLAN_FEATURES.multi.map((f) => FEATURE_LABEL[f]),
    ],
  };
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {plans.map((p) => {
        const mine = p === plan;
        return (
          <div
            key={p}
            className={cn(
              "rounded-xl border p-3",
              mine ? "border-primary bg-primary/5" : "border-border",
            )}
          >
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[13px] font-semibold">{tr(PLAN_LABEL[p])}</p>
              {mine ? (
                <StatusBadge tone="info" shape="rounded">
                  {"Your plan"}
                </StatusBadge>
              ) : null}
            </div>
            <ul className="space-y-0.5 text-[11px]">
              {[...base, ...extra[p]].map((f) => (
                <li key={f} className="flex items-center gap-1.5">
                  {mine || p === "single" || base.includes(f) ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  {tr(f)}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
