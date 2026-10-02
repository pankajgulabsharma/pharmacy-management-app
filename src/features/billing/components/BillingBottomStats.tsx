import { useTranslation } from "react-i18next";
import {
  IndianRupee,
  Receipt,
  ShoppingCart,
  type LucideIcon,
} from "lucide-react";
import { StatusBadge, type BadgeTone } from "@/components/common/StatusBadge";
import { recentSalesMock, type SaleStatus } from "../data/mockBillingData";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<SaleStatus, BadgeTone> = {
  Paid: "success",
  Pending: "warning",
  Hold: "caution",
  Udhaar: "danger",
};

function statusLabel(status: SaleStatus, t: (k: string) => string) {
  if (status === "Paid") return t("billing.paid");
  if (status === "Pending") return t("billing.pending");
  return status;
}

/** Gradient KPI card used only on the billing screen */
function TrendCard({
  label,
  value,
  change,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  change: string;
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
          <p className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 mt-0.5">
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

export function BillingBottomStats() {
  const { t } = useTranslation();
  const rows = recentSalesMock.slice(0, 5);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5 shrink-0">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2.5">
        <TrendCard
          label={t("billing.totalSales")}
          value="₹8,750"
          change="↑ 12%"
          icon={IndianRupee}
          accent={ACCENTS.primary}
        />
        <TrendCard
          label={t("billing.totalBills")}
          value="156"
          change="↑ 12%"
          icon={Receipt}
          accent={ACCENTS.violet}
        />
        <TrendCard
          label={t("billing.todayPurchase")}
          value="₹8,750"
          change="↑ 8%"
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
          <button
            type="button"
            className="inline-flex items-center rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1 text-[10px] font-medium text-primary hover:bg-primary/10 transition-colors"
          >
            {t("common.viewAll")}
          </button>
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
              {rows.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-border/60 last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-2 py-1.5 font-medium text-foreground">
                    {s.billNo}
                  </td>
                  <td className="px-2 py-1.5 text-foreground truncate max-w-[90px]">
                    {s.customer}
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">
                    {s.date}
                  </td>
                  <td className="px-2 py-1.5 text-foreground tabular-nums">
                    ₹{s.amount}
                  </td>
                  <td className="px-2 py-1.5">
                    <StatusBadge tone={STATUS_TONE[s.status]} size="xs">
                      {statusLabel(s.status, t)}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
