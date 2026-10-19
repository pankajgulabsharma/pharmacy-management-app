import { useState } from "react";
import {
  Check,
  CheckCircle2,
  Monitor,
  MonitorSmartphone,
  Sparkles,
  X,
} from "lucide-react";
import { PLAN_LABEL, type Plan } from "@medicare/domain/license/plan";
import { cn } from "@/lib/utils";
import { tr } from "@/lib/i18n";
import { SupportDialog } from "@/features/support/SupportDialog";
import { UpgradeButton } from "@/features/support/UpgradeButton";

/** In both plans — the whole pharmacy */
const BASICS = [
  "Billing with GST, barcode & bill tabs",
  "Medicines, batches & expiry, stock",
  "Purchases, suppliers & returns",
  "Customers, udhaar & refill reminders",
  "Reports, GST returns & doctor referrals",
  "Daily backups + Google Drive / pen drive copy",
  "WhatsApp bills & orders, Hindi / English",
];

/** What Multi-counter adds — each with why it matters */
const MULTI_EXTRAS: [title: string, detail: string][] = [
  [
    "Several billing counters",
    "Every counter bills from the same stock and the same bills — updated live, nothing to sync.",
  ],
  [
    "Staff commission",
    "A % of the bills each person makes, worked out by itself from who billed.",
  ],
  [
    "Who is connected now",
    "See which computers are open and who is signed in on each.",
  ],
  [
    "New counters connect by themselves",
    "“Find main computer” — no IP addresses to type.",
  ],
];

const ICON = { single: Monitor, multi: MonitorSmartphone } as const;

/**
 * The two plans side by side: what this shop has (highlighted), what the
 * other adds — and Upgrade on the one not bought yet.
 */
export function PlanCards({ plan }: { plan: Plan }) {
  const [help, setHelp] = useState(false);
  const plans: Plan[] = ["single", "multi"];

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {plans.map((p) => {
        const mine = p === plan;
        const upgrade = p === "multi" && plan === "single";
        const Icon = ICON[p];
        return (
          <section
            key={p}
            className={cn(
              "relative flex flex-col rounded-2xl p-4 transition",
              mine
                ? "animated-border border-2 shadow-lg shadow-primary/10 [--mc-fill:color-mix(in_oklab,var(--color-primary)_5%,var(--color-card))]"
                : upgrade
                  ? "animated-border border-2 [--mc-fill:color-mix(in_oklab,#8b5cf6_6%,var(--color-card))] [animation-delay:-1.75s]"
                  : "animated-border border-2 [animation-delay:-1.75s]",
            )}
          >
            {mine ? (
              <span className="absolute -top-2.5 left-4 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-semibold text-primary-foreground shadow">
                <CheckCircle2 className="h-3 w-3" />
                {tr("Your plan")}
              </span>
            ) : upgrade ? (
              <span className="absolute -top-2.5 left-4 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-2.5 py-0.5 text-[10px] font-semibold text-white shadow">
                <Sparkles className="h-3 w-3" />
                {tr("Recommended for 2+ counters")}
              </span>
            ) : null}

            <div className="mb-3 mt-1 flex items-center gap-3">
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl",
                  mine
                    ? "bg-primary text-primary-foreground"
                    : "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[15px] font-semibold">{tr(PLAN_LABEL[p])}</p>
                <p className="text-[11px] text-muted-foreground">
                  {tr(
                    p === "single"
                      ? "One billing computer"
                      : "Main computer + extra counters",
                  )}
                </p>
              </div>
            </div>

            {p === "single" ? (
              <>
                <ul className="space-y-1.5">
                  {BASICS.map((f) => (
                    <li key={f} className="flex gap-2 text-[12px]">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      {tr(f)}
                    </li>
                  ))}
                </ul>
                <ul className="mt-3 space-y-1.5 border-t border-dashed border-border pt-3">
                  {MULTI_EXTRAS.map(([f]) => (
                    <li
                      key={f}
                      className="flex gap-2 text-[12px] text-muted-foreground line-through decoration-muted-foreground/40"
                    >
                      <X className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {tr(f)}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <p className="mb-2 text-[12px] font-medium">
                  {tr("Everything in Single computer, plus:")}
                </p>
                <ul className="space-y-2.5">
                  {MULTI_EXTRAS.map(([f, d]) => (
                    <li key={f} className="flex gap-2.5">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                        <Sparkles className="h-3 w-3" />
                      </span>
                      <span>
                        <span className="block text-[12px] font-semibold">
                          {tr(f)}
                        </span>
                        <span className="block text-[11px] text-muted-foreground">
                          {tr(d)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {upgrade ? (
              <div className="mt-auto pt-4">
                <UpgradeButton
                  onClick={() => setHelp(true)}
                  className="w-full justify-center"
                />
              </div>
            ) : null}
          </section>
        );
      })}
      {help ? <SupportDialog onClose={() => setHelp(false)} /> : null}
    </div>
  );
}
