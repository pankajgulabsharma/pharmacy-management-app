import { useNavigate } from "react-router-dom";
import { StatusBadge, type BadgeTone } from "@/components/common/StatusBadge";
import { inrFromPaise } from "@medicare/domain/lib/money";
import type { Sale } from "@medicare/domain/billing/types";
import type { DashboardData } from "../hooks/useDashboardData";
import { ViewAll } from "./DashLink";
import { tr } from "@/lib/i18n";

const STATUS: Record<
  "paid" | "udhaar" | "returned",
  { label: string; tone: BadgeTone }
> = {
  paid: { label: "Paid", tone: "success" },
  udhaar: { label: "Udhaar", tone: "danger" },
  returned: { label: "Returned", tone: "caution" },
};

const status = (s: Sale) => (s.returnedPaise > 0 ? "returned" : s.status);
const time = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** Latest bills — click a row to open Sales Return for it, or the report */
export function RecentSales({ d }: { d: DashboardData }) {
  const navigate = useNavigate();
  return (
    <div className="bg-card border border-border rounded-xl p-3 h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between mb-2 shrink-0">
        <h3 className="text-xs font-semibold text-foreground">
          {tr("Recent sales")}
        </h3>
        <ViewAll to="/reports?tab=sales&period=today" />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {d.recentSales.length === 0 ? (
          <p className="py-6 text-center text-[11px] text-muted-foreground">
            {tr("No bills yet — press F2 to start one")}
          </p>
        ) : (
          // One row = two short lines, so nothing is cut at any width:
          // bill no. + amount on top, customer · time below, status right
          <ul className="divide-y divide-border/60">
            {d.recentSales.map((s) => {
              const meta = STATUS[status(s)];
              return (
                <li
                  key={s.id}
                  tabIndex={0}
                  onClick={() => navigate(`/reports?tab=sales&period=today`)}
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    navigate(`/reports?tab=sales&period=today`)
                  }
                  className="flex items-center gap-3 px-1.5 py-2 rounded-md hover:bg-muted/40 cursor-pointer transition-colors focus-visible:outline-none focus-visible:bg-primary/10"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-mono text-[10.5px] font-semibold text-foreground truncate">
                        {s.billNo}
                      </span>
                      <span className="text-[11px] font-semibold tabular-nums text-foreground whitespace-nowrap">
                        {inrFromPaise(s.totals.netPaise)}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">
                      <span title={s.customerName}>{s.customerName}</span>
                      {" · "}
                      {time.format(new Date(s.createdAt))}
                    </p>
                  </div>
                  <StatusBadge
                    tone={meta.tone}
                    size="xs"
                    className="shrink-0 w-[62px] justify-center"
                  >
                    {meta.label}
                  </StatusBadge>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
