import { useTranslation } from "react-i18next";
import { topSellingData } from "../data/mockData";

export function TopSellingMedicines() {
  const { t } = useTranslation();
  const visibleItems = topSellingData.slice(0, 5);

  return (
    <div className="bg-card border border-border rounded-xl p-3 h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between mb-2 shrink-0">
        <h3 className="text-xs font-semibold text-foreground">
          {t("topSelling.title")}
        </h3>
        <button
          type="button"
          className="inline-flex items-center rounded-lg border border-border bg-background px-2.5 py-1 text-[10px] font-medium text-primary hover:bg-muted transition-colors"
        >
          {t("common.viewAll")}
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-1">
        {visibleItems.map((item) => (
          <div
            key={item.id}
            className="grid grid-cols-3 items-center rounded-lg px-1.5 py-1.5 hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-[10px] font-semibold text-foreground shrink-0">
                {item.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-foreground truncate">
                  {item.name}
                </p>
                <p className="text-[9px] text-muted-foreground truncate">
                  {item.generic}
                </p>
              </div>
            </div>
            <p className="text-[11px] font-semibold text-foreground tabular-nums text-center">
              {item.qtySold} {t("topSelling.pcs")}
            </p>
            <p className="text-[11px] font-medium text-muted-foreground tabular-nums text-right">
              ₹{item.revenue.toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
