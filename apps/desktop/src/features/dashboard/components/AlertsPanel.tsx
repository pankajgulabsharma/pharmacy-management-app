import { Link } from "react-router-dom";
import {
  CalendarClock,
  CalendarX,
  CheckCircle2,
  HandCoins,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { inrRounded } from "@/lib/money";
import type { DashboardData } from "../hooks/useDashboardData";
import { tr } from "@/lib/i18n";

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
      title: `${d.stock.expired.length} ${tr(d.stock.expired.length === 1 ? "batch expired" : "batches expired")}`,
      desc: `${inrRounded(d.stock.expiredValuePaise)} ${tr("at cost — not sellable. Return to supplier or dispose.")}`,
      icon: CalendarX,
      tone: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400",
      to: "/inventory?status=expired",
    });
  }
  if (d.supplier.overdueCount) {
    alerts.push({
      key: "overdue",
      title: `${d.supplier.overdueCount} ${tr(d.supplier.overdueCount === 1 ? "invoice overdue" : "invoices overdue")}`,
      desc: `${inrRounded(d.supplier.overduePaise)} ${tr("past the due date.")}`,
      icon: Wallet,
      tone: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400",
      to: "/purchases?status=overdue",
    });
  }
  if (d.stock.expiring.length) {
    alerts.push({
      key: "expiring",
      title: `${d.stock.expiring.length} ${tr(d.stock.expiring.length === 1 ? "batch expiring soon" : "batches expiring soon")}`,
      desc: tr("Within {{days}} days — sell first or return in time.", {
        days: d.expiringDays,
      }),
      icon: CalendarClock,
      tone: "bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400",
      to: "/inventory?status=expiring",
    });
  }
  if (d.udhaarPaise > 0) {
    alerts.push({
      key: "udhaar",
      title: `${inrRounded(d.udhaarPaise)} ${tr("udhaar to collect")}`,
      desc: tr("Customers who bought on credit — open their accounts."),
      icon: HandCoins,
      tone: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
      to: "/customers", // all, most owed first
    });
  }

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
