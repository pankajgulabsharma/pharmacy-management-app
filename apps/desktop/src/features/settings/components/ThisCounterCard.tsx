import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MonitorDot } from "lucide-react";
import { fieldClass } from "@/components/common/formStyles";
import { tr } from "@/lib/i18n";
import { setThisCounter, thisCounter } from "@/lib/thisCounter";
import { useSettingsStore } from "../store/useSettingsStore";

/** "This computer is Counter 2" — saved on this computer only */
export function ThisCounterCard() {
  const counters = useSettingsStore((s) => s.counters);
  const fallback = useSettingsStore((s) => s.billing.defaultCounter);
  const [mine, setMine] = useState(thisCounter);
  useEffect(() => {
    const on = () => setMine(thisCounter());
    window.addEventListener("medicare:this-counter", on);
    return () => window.removeEventListener("medicare:this-counter", on);
  }, []);
  const value = counters.includes(mine) ? mine : "";

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MonitorDot className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">
            {tr("Which counter is this computer?")}
          </h2>
          <p className="text-[11px] text-muted-foreground">
            {tr(
              "Bills made here start on this counter; its cash goes into this counter's galla; sign-ins show it. Set it once on every computer.",
            )}
          </p>
        </div>
        <select
          aria-label={tr("This computer's counter")}
          value={value}
          onChange={(e) => {
            setThisCounter(e.target.value);
            toast.success(
              e.target.value
                ? tr("This computer is now {{c}}", { c: e.target.value })
                : tr("Not set — the default counter is used"),
            );
          }}
          className={`${fieldClass} w-48`}
        >
          <option value="">
            {tr("Not set ({{c}})", { c: fallback || counters[0] || "" })}
          </option>
          {counters.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}
