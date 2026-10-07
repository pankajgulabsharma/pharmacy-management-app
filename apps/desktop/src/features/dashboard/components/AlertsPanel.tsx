import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { tr } from "@/lib/i18n";
import { ALERT_TONE, useShopAlerts } from "@/features/alerts/useShopAlerts";

/** Things that need attention today — each opens the place to act on it */
export function AlertsPanel() {
  const alerts = useShopAlerts();

  if (alerts.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-3 flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950 flex items-center justify-center">
          <CheckCircle2 className="h-4 w-4" />
        </div>
        <p className="text-xs font-medium">
          {tr("All good — nothing needs attention.")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {alerts.map((a) => (
        <Link
          key={a.key}
          to={a.to}
          className="bg-card border border-border rounded-xl p-2.5 flex items-start gap-2.5 hover:border-primary/40 hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div
            className={cn(
              "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
              ALERT_TONE[a.level],
            )}
          >
            <a.icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground">{a.title}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
              {a.desc}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
