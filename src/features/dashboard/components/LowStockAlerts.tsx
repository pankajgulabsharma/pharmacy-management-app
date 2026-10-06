import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { FitRow } from "@/components/common/FitRow";
import type { DashboardData } from "../hooks/useDashboardData";
import { ViewAll } from "./DashLink";
import { tr } from "@/lib/i18n";

/** Medicines below their minimum — click one to see its batches in Inventory */
export function LowStockAlerts({ d }: { d: DashboardData }) {
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2">
      <div className="flex items-center justify-between mb-1.5">
        <h3 className="text-xs font-semibold text-foreground">
          Below minimum stock{" "}
          <span className="text-muted-foreground font-normal">
            ({d.lowStockList.length})
          </span>
        </h3>
        <ViewAll to="/medicines?status=low_only" />
      </div>
      {d.lowStockList.length === 0 ? (
        <p className="text-[10px] text-muted-foreground">
          {tr("Everything is above minimum.")}
        </p>
      ) : (
        <FitRow
          items={d.lowStockList}
          getKey={(item) => item.medicineId}
          renderItem={(item) => {
            const out = item.stockText.startsWith("0 ");
            return (
              <Link
                to={`/inventory?q=${encodeURIComponent(item.name)}`}
                title={`${item.name} — minimum ${item.minStock}. Open in Inventory`}
                className={cn(
                  "inline-flex whitespace-nowrap items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  out
                    ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400"
                    : "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:border-orange-900 dark:bg-orange-950/50 dark:text-orange-400",
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full shrink-0",
                    out ? "bg-red-500" : "bg-orange-500",
                  )}
                />
                <span className="font-medium">{item.name}</span>
                <span className="opacity-80">{item.stockText}</span>
              </Link>
            );
          }}
          renderMore={(n) => (
            <Link
              to="/medicines?status=low_only"
              className="inline-flex whitespace-nowrap items-center rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-primary hover:bg-muted"
            >
              +{n} more
            </Link>
          )}
        />
      )}
    </div>
  );
}
