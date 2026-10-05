import { Link } from "react-router-dom";
import {
  CalendarClock,
  CalendarX,
  CheckCircle2,
  PauseCircle,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { inrRounded } from "@/lib/money";
import { plural } from "@/lib/format";
import type { DashboardData } from "../hooks/useDashboardData";

type Alert = {
  key: string;
  title: string;
  desc: string;
  icon: LucideIcon;
  tone: string;
  to: string;
};

/** Things that need attention today — each opens the place to act on it */
export function AlertsPanel({ d }: { d: DashboardData }) {
  const alerts: Alert[] = [];
  if (d.stock.expired.length) {
    alerts.push({
      key: "expired",
      title: `${plural(d.stock.expired.length, "batch", "batches")} expired`,
      desc: `${inrRounded(d.stock.expiredValuePaise)} at cost — not sellable. Return to supplier or dispose.`,
      icon: CalendarX,
      tone: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400",
      to: "/inventory?status=expired",
    });
  }
  if (d.supplier.overdueCount) {
    alerts.push({
      key: "overdue",
      title: `${plural(d.supplier.overdueCount, "invoice")} overdue`,
      desc: `${inrRounded(d.supplier.overduePaise)} past the due date.`,
      icon: Wallet,
      tone: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400",
      to: "/purchases?status=overdue",
    });
  }
  if (d.stock.expiring.length) {
    alerts.push({
      key: "expiring",
      title: `${plural(d.stock.expiring.length, "batch", "batches")} expiring soon`,
      desc: `Within ${d.expiringDays} days — sell first or return in time.`,
      icon: CalendarClock,
      tone: "bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400",
      to: "/inventory?status=expiring",
    });
  }
  if (d.heldCount) {
    alerts.push({
      key: "held",
      title: `${plural(d.heldCount, "bill")} on hold`,
      desc: "Customers waiting — resume from Billing (F6).",
      icon: PauseCircle,
      tone: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
      to: "/billing",
    });
  }

  if (alerts.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-3 flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950 flex items-center justify-center">
          <CheckCircle2 className="h-4 w-4" />
        </div>
        <p className="text-xs font-medium">
          All good — nothing needs attention.
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
              a.tone,
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
