import { useTranslation } from "react-i18next";
import { lowStockData } from "../data/mockData";
import { cn } from "@/lib/utils";

export function LowStockAlerts() {
  const { t } = useTranslation();

  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2">
      <div className="flex items-center justify-between mb-1.5">
        <h3 className="text-xs font-semibold text-foreground">
          {t("lowStock.title")}
        </h3>
        <button
          type="button"
          className="inline-flex items-center rounded-lg border border-border bg-background px-2.5 py-1 text-[10px] font-medium text-primary hover:bg-muted transition-colors"
        >
          {t("common.viewAll")}
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {lowStockData.map((item) => {
          const isCritical = item.stock <= 8;
          const isWarning = item.stock > 8 && item.stock <= 15;
          return (
            <div
              key={item.id}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px]",
                isCritical &&
                  "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400",
                isWarning &&
                  "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/50 dark:text-orange-400",
                !isCritical &&
                  !isWarning &&
                  "border-border bg-muted/60 text-foreground",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full shrink-0",
                  isCritical && "bg-red-500",
                  isWarning && "bg-orange-500",
                  !isCritical && !isWarning && "bg-emerald-500",
                )}
              />
              <span className="font-medium">{item.name}</span>
              <span className="text-muted-foreground">
                {t("lowStock.stock")}: {item.stock}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
