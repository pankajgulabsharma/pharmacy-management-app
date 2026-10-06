import { Link } from "react-router-dom";
import { inrRounded } from "@medicare/domain/lib/money";
import type { DashboardData } from "../hooks/useDashboardData";
import { ViewAll } from "./DashLink";
import { tr } from "@/lib/i18n";

/** Best sellers of the last 30 days — click one to open it in Medicines */
export function TopSellingMedicines({ d }: { d: DashboardData }) {
  const items = d.month.topMedicines.slice(0, 5);
  return (
    <div className="bg-card border border-border rounded-xl p-3 h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between mb-2 shrink-0">
        <div>
          <h3 className="text-xs font-semibold text-foreground">
            {tr("Top selling")}
          </h3>
          <p className="text-[9px] text-muted-foreground">
            {tr("Last 30 days")}
          </p>
        </div>
        <ViewAll to="/reports?tab=sales&period=30d" />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto space-y-1">
        {items.length === 0 ? (
          <p className="py-6 text-center text-[11px] text-muted-foreground">
            {tr("No sales yet")}
          </p>
        ) : (
          items.map((m, i) => (
            <Link
              key={m.medicineId}
              to={`/medicines?q=${encodeURIComponent(m.name)}`}
              className="grid grid-cols-[1fr_auto_auto] gap-3 items-center rounded-lg px-1.5 py-1.5 hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-[10px] font-semibold shrink-0">
                  #{i + 1}
                </div>
                <p
                  className="text-[11px] font-medium text-foreground leading-tight line-clamp-2"
                  title={m.name}
                >
                  {m.name}
                </p>
              </div>
              <p className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
                {[
                  m.qtyStrip ? `${m.qtyStrip} ${m.unit}` : "",
                  m.qtyLoose ? `${m.qtyLoose} LSE` : "",
                ]
                  .filter(Boolean)
                  .join(" + ")}
              </p>
              <p className="text-[11px] font-semibold text-foreground tabular-nums text-right w-16">
                {inrRounded(m.amountPaise)}
              </p>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
