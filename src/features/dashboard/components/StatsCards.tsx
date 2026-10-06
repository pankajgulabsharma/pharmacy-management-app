import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CalendarClock,
  ChevronRight,
  IndianRupee,
  Receipt,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { inrRounded } from "@/lib/money";
import { plural } from "@/lib/format";
import type { DashboardData } from "../hooks/useDashboardData";
import { useTr } from "@/hooks/useTr";
import { tr } from "@/lib/i18n";

type Card = {
  key: string;
  label: string;
  value: string;
  sub: string;
  subTone?: "good" | "bad" | "muted";
  icon: LucideIcon;
  iconBg: string;
  to: string;
};

const trend = (pct: number | null) =>
  pct === null
    ? { text: tr("No sales yesterday"), tone: "muted" as const }
    : {
        text: `${pct >= 0 ? "↑" : "↓"} ${Math.abs(pct)}% ${tr("vs yesterday")}`,
        tone: pct >= 0 ? ("good" as const) : ("bad" as const),
      };

/** Five live KPIs — each opens the screen behind the number */
export function StatsCards({ d }: { d: DashboardData }) {
  const tr = useTr();
  const sales = trend(d.salesChange);
  const bills = trend(d.billsChange);
  const cards: Card[] = [
    {
      key: "sales",
      label: "Today's sales",
      value: inrRounded(d.today.netAfterReturnsPaise),
      sub: sales.text,
      subTone: sales.tone,
      icon: IndianRupee,
      iconBg: "bg-primary/10 text-primary",
      to: "/reports?tab=sales&period=today",
    },
    {
      key: "bills",
      label: "Bills today",
      value: String(d.today.billCount),
      sub: bills.text,
      subTone: bills.tone,
      icon: Receipt,
      iconBg: "bg-violet-500/10 text-violet-600",
      to: "/reports?tab=sales&period=today",
    },
    {
      key: "low",
      label: "Low / out of stock",
      value: String(d.health.low + d.health.out),
      sub: `${d.health.out} out of stock`,
      subTone: d.health.out > 0 ? "bad" : "muted",
      icon: AlertTriangle,
      iconBg: "bg-orange-500/10 text-orange-600",
      to: "/medicines?status=low_only", // opens the Low chip
    },
    {
      key: "expiring",
      label: `Expiring in ${d.expiringDays} days`,
      value: plural(d.stock.expiring.length, "batch", "batches"),
      sub: `${inrRounded(d.stock.expiringValuePaise)} at cost`,
      subTone: d.stock.expiring.length ? "bad" : "muted",
      icon: CalendarClock,
      iconBg: "bg-amber-500/10 text-amber-600",
      to: "/inventory?status=expiring",
    },
    {
      key: "dues",
      label: "To pay suppliers",
      value: inrRounded(d.supplier.duePaise),
      sub: d.supplier.overdueCount
        ? `${inrRounded(d.supplier.overduePaise)} overdue`
        : "Nothing overdue",
      subTone: d.supplier.overdueCount ? "bad" : "good",
      icon: Wallet,
      iconBg: "bg-red-500/10 text-red-500",
      to: "/suppliers", // all, most owed first
    },
  ];

  return (
    <div className="grid grid-cols-5 gap-2 xl:gap-2.5">
      {cards.map((c) => (
        <Link
          key={c.key}
          to={c.to}
          // @container: the card adapts to its OWN width, so all five always
          // fit in one row — text wraps instead of being cut
          className="@container group min-w-0 bg-card border border-border rounded-xl p-2 @min-[140px]:p-2.5 text-left hover:border-primary/40 hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div
            className={cn(
              "h-7 w-7 rounded-lg flex items-center justify-center",
              c.iconBg,
            )}
          >
            <c.icon className="h-3.5 w-3.5" />
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-1">
            <p className="text-[10px] text-muted-foreground leading-tight">
              {tr(c.label)}
            </p>
            <ChevronRight className="hidden @min-[140px]:block h-3.5 w-3.5 text-muted-foreground shrink-0 group-hover:translate-x-0.5 group-hover:text-primary transition" />
          </div>
          <h3 className="text-[13px] @min-[140px]:text-sm font-bold text-foreground leading-tight mt-1 tabular-nums whitespace-nowrap">
            {c.value}
          </h3>
          <p
            className={cn(
              "text-[9px] mt-1 font-medium leading-tight",
              c.subTone === "good" && "text-emerald-600 dark:text-emerald-400",
              c.subTone === "bad" && "text-red-500 dark:text-red-400",
              c.subTone === "muted" && "text-muted-foreground",
            )}
          >
            {c.sub}
          </p>
        </Link>
      ))}
    </div>
  );
}
