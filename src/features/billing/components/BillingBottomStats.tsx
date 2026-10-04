import { useTranslation } from "react-i18next";
import {
  IndianRupee,
  Receipt,
  ShoppingCart,
  type LucideIcon,
} from "lucide-react";
import { useMemo } from "react";
import { StatusBadge, type BadgeTone } from "@/components/common/StatusBadge";
import { usePurchaseStore } from "@/features/purchases/store/usePurchaseStore";
import { formatRupees, inrFromPaise } from "@/lib/money";
import { isSameDay } from "@/lib/date";
import { useSalesStore } from "../store/useSalesStore";
import type { Sale } from "../types";
import { cn } from "@/lib/utils";

type RowStatus = "paid" | "udhaar" | "returned";

const STATUS_META: Record<RowStatus, { label: string; tone: BadgeTone }> = {
  paid: { label: "Paid", tone: "success" },
  udhaar: { label: "Udhaar", tone: "danger" },
  returned: { label: "Returned", tone: "caution" },
};

function rowStatus(s: Sale): RowStatus {
  if (s.returnedPaise > 0) return "returned";
  return s.status;
}

/** "↑ 12%" / "↓ 5%" vs yesterday; "—" when there is nothing to compare */
function trend(
  today: number,
  yesterday: number,
): { text: string; up: boolean } {
  if (yesterday <= 0) return { text: today > 0 ? "New today" : "—", up: true };
  const pct = Math.round(((today - yesterday) / yesterday) * 100);
  return {
    text: `${pct >= 0 ? "↑" : "↓"} ${Math.abs(pct)}% vs yesterday`,
    up: pct >= 0,
  };
}

/** Gradient KPI card used only on the billing screen */
function TrendCard({
  label,
  value,
  change,
  up,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  change: string;
  up: boolean;
  icon: LucideIcon;
  accent: { card: string; label: string; icon: string };
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-gradient-to-br p-3",
        accent.card,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className={cn("text-[10px] font-medium", accent.label)}>{label}</p>
          <p className="text-base font-bold text-foreground mt-1">{value}</p>
          <p
            className={cn(
              "text-[10px] font-medium mt-0.5",
              up ? "text-emerald-600 dark:text-emerald-400" : "text-red-500",
            )}
          >
            {change}
          </p>
        </div>
        <div
          className={cn(
            "h-8 w-8 rounded-lg flex items-center justify-center shadow-sm",
            accent.icon,
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

const ACCENTS = {
  primary: {
    card: "border-primary/15 from-primary/10 to-primary/5",
    label: "text-primary/80",
    icon: "bg-primary text-primary-foreground",
  },
  violet: {
    card: "border-violet-500/15 from-violet-500/10 to-violet-500/5",
    label: "text-violet-600 dark:text-violet-400",
    icon: "bg-violet-600 text-white",
  },
  orange: {
    card: "border-orange-500/15 from-orange-500/10 to-orange-500/5",
    label: "text-orange-600 dark:text-orange-400",
    icon: "bg-orange-500 text-white",
  },
} as const;

export function BillingBottomStats({ onViewAll }: { onViewAll?: () => void }) {
  const { t } = useTranslation();
  const sales = useSalesStore((st) => st.sales);
  const purchases = usePurchaseStore((st) => st.purchases);

  const stats = useMemo(() => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    let todaySales = 0;
    let ydaySales = 0;
    let todayBills = 0;
    let ydayBills = 0;
    for (const s of sales) {
      const d = new Date(s.createdAt);
      const net = s.totals.netPaise - s.returnedPaise;
      if (isSameDay(d, now)) {
        todaySales += net;
        todayBills++;
      } else if (isSameDay(d, yesterday)) {
        ydaySales += net;
        ydayBills++;
      }
    }
    let todayPurchase = 0;
    let ydayPurchase = 0;
    for (const p of purchases) {
      if (p.status === "cancelled") continue;
      const d = new Date(`${p.invoiceDate}T00:00:00`);
      if (isSameDay(d, now)) todayPurchase += p.totals.netPaise;
      else if (isSameDay(d, yesterday)) ydayPurchase += p.totals.netPaise;
    }
    return {
      todaySales,
      todayBills,
      todayPurchase,
      salesTrend: trend(todaySales, ydaySales),
      billsTrend: trend(todayBills, ydayBills),
      purchaseTrend: trend(todayPurchase, ydayPurchase),
    };
  }, [sales, purchases]);

  const rows = sales.slice(0, 5);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5 shrink-0">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2.5">
        <TrendCard
          label={t("billing.totalSales")}
          value={`₹${formatRupees(stats.todaySales / 100).replace(/\.00$/, "")}`}
          change={stats.salesTrend.text}
          up={stats.salesTrend.up}
          icon={IndianRupee}
          accent={ACCENTS.primary}
        />
        <TrendCard
          label={t("billing.totalBills")}
          value={String(stats.todayBills)}
          change={stats.billsTrend.text}
          up={stats.billsTrend.up}
          icon={Receipt}
          accent={ACCENTS.violet}
        />
        <TrendCard
          label={t("billing.todayPurchase")}
          value={`₹${formatRupees(stats.todayPurchase / 100).replace(/\.00$/, "")}`}
          change={stats.purchaseTrend.text}
          up={stats.purchaseTrend.up}
          icon={ShoppingCart}
          accent={ACCENTS.orange}
        />
      </div>

      {/* Recent Sales — dashboard style */}
      <div className="bg-card border border-border rounded-xl p-3 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-2 shrink-0">
          <h3 className="text-xs font-semibold text-foreground">
            {t("billing.recentSales")}
          </h3>
          {onViewAll ? (
            <button
              type="button"
              onClick={onViewAll}
              className="inline-flex items-center rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1 text-[10px] font-medium text-primary hover:bg-primary/10 transition-colors"
            >
              {t("common.viewAll")}
            </button>
          ) : null}
        </div>

        <div className="overflow-y-auto max-h-[96px]">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="bg-muted/60 text-muted-foreground">
                <th className="text-left font-medium px-2 py-1.5 rounded-l-md">
                  Invoice
                </th>
                <th className="text-left font-medium px-2 py-1.5">
                  {t("billing.customer")}
                </th>
                <th className="text-left font-medium px-2 py-1.5">
                  {t("billing.dateTime")}
                </th>
                <th className="text-left font-medium px-2 py-1.5">
                  {t("billing.amount")}
                </th>
                <th className="text-left font-medium px-2 py-1.5 rounded-r-md">
                  {t("billing.status")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const meta = STATUS_META[rowStatus(s)];
                return (
                  <tr
                    key={s.id}
                    className="border-b border-border/60 last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-2 py-1.5 font-medium text-foreground font-mono">
                      {s.billNo}
                    </td>
                    <td className="px-2 py-1.5 text-foreground truncate max-w-[90px]">
                      {s.customerName}
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">
                      {new Date(s.createdAt).toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-2 py-1.5 text-foreground tabular-nums">
                      {inrFromPaise(s.totals.netPaise)}
                    </td>
                    <td className="px-2 py-1.5">
                      <StatusBadge tone={meta.tone} size="xs">
                        {meta.label}
                      </StatusBadge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
