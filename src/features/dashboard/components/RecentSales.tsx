import { useTranslation } from "react-i18next";
import { recentSalesData } from "../data/mockData";
import { StatusBadge } from "@/components/common/StatusBadge";

export function RecentSales() {
  const { t } = useTranslation();
  const visibleSales = recentSalesData.slice(0, 5);

  return (
    <div className="bg-card border border-border rounded-xl p-3 h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between mb-2 shrink-0">
        <h3 className="text-xs font-semibold text-foreground">
          {t("recentSales.title")}
        </h3>
        <button
          type="button"
          className="inline-flex items-center rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1 text-[10px] font-medium text-primary hover:bg-primary/10 transition-colors"
        >
          {t("common.viewAll")}
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="bg-muted/60 text-muted-foreground">
              <th className="text-left font-medium px-2 py-1.5 rounded-l-md">
                {t("recentSales.invoice")}
              </th>
              <th className="text-left font-medium px-2 py-1.5">
                {t("recentSales.customer")}
              </th>
              <th className="text-left font-medium px-2 py-1.5">
                {t("billing.dateTime")}
              </th>
              <th className="text-left font-medium px-2 py-1.5">
                {t("recentSales.amount")}
              </th>
              <th className="text-left font-medium px-2 py-1.5 rounded-r-md">
                {t("recentSales.status")}
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleSales.map((sale) => (
              <tr
                key={sale.id}
                className="border-b border-border/60 last:border-0 hover:bg-muted/30 transition-colors"
              >
                <td className="px-2 py-1.5 font-medium text-foreground">
                  {sale.invoiceNo}
                </td>
                <td className="px-2 py-1.5 text-foreground truncate max-w-[90px]">
                  {sale.customer}
                </td>
                <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">
                  {sale.time}
                </td>
                <td className="px-2 py-1.5 text-foreground tabular-nums">
                  ₹{sale.amount}
                </td>
                <td className="px-2 py-1.5">
                  <StatusBadge
                    tone={sale.status === "Paid" ? "success" : "warning"}
                    size="xs"
                  >
                    {sale.status === "Paid"
                      ? t("recentSales.paid")
                      : t("recentSales.pending")}
                  </StatusBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
