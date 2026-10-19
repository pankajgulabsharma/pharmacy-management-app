import { useState } from "react";
import { Lock, Sparkles } from "lucide-react";
import { PLAN_LABEL, type Plan } from "@medicare/domain/license/plan";
import { UpgradeButton } from "./UpgradeButton";
import { tr } from "@/lib/i18n";
import { SupportDialog } from "./SupportDialog";

/** A part of the app the shop's plan doesn't include — and how to get it */
export function LockedFeature({
  title,
  description,
  plan = "multi",
}: {
  title: string;
  description: string;
  plan?: Plan;
}) {
  const [help, setHelp] = useState(false);
  return (
    <section className="flex flex-wrap items-center gap-4 rounded-xl border border-dashed border-primary/40 bg-gradient-to-r from-primary/5 to-transparent p-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Lock className="h-5 w-5" />
      </span>
      <div className="min-w-[220px] flex-1">
        <p className="flex items-center gap-2 text-[13px] font-semibold">
          {tr(title)}
          <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
            <Sparkles className="h-3 w-3" />
            {tr(PLAN_LABEL[plan])}
          </span>
        </p>
        <p className="text-[11px] text-muted-foreground">{tr(description)}</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          {tr(
            "Upgrade opens Help & support — your provider sends a new licence key.",
          )}
        </p>
      </div>
      <UpgradeButton onClick={() => setHelp(true)} />
      {help ? <SupportDialog onClose={() => setHelp(false)} /> : null}
    </section>
  );
}
