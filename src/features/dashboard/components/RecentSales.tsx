import { useNavigate } from "react-router-dom";
import { StatusBadge, type BadgeTone } from "@/components/common/StatusBadge";
import { inrFromPaise } from "@/lib/money";
import type { Sale } from "@/features/billing/types";
import type { DashboardData } from "../hooks/useDashboardData";
import { ViewAll } from "./DashLink";

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
        <h3 className="text-xs font-semibold text-foreground">Recent sales</h3>
        <ViewAll to="/reports?tab=sales&period=today" />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {d.recentSales.length === 0 ? (
          <p className="py-6 text-center text-[11px] text-muted-foreground">
            No bills yet — press F2 to start one
          </p>
        ) : (
          <table className="w-full text-[10px]">
            <thead>
              <tr className="bg-muted/60 text-muted-foreground">
                <th className="text-left font-medium px-2 py-1.5 rounded-l-md">
                  Bill
                </th>
                <th className="text-left font-medium px-2 py-1.5">Customer</th>
                <th className="text-left font-medium px-2 py-1.5">
                  Date & time
                </th>
                <th className="text-right font-medium px-2 py-1.5">Amount</th>
                <th className="text-left font-medium px-2 py-1.5 rounded-r-md">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {d.recentSales.map((s) => {
                const meta = STATUS[status(s)];
                return (
                  <tr
                    key={s.id}
                    tabIndex={0}
                    onClick={() => navigate(`/reports?tab=sales&period=today`)}
                    onKeyDown={(e) =>
                      e.key === "Enter" &&
                      navigate(`/reports?tab=sales&period=today`)
                    }
                    className="border-b border-border/60 last:border-0 hover:bg-muted/40 cursor-pointer transition-colors focus-visible:outline-none focus-visible:bg-primary/10"
                  >
                    <td className="px-2 py-1.5 font-medium font-mono text-foreground whitespace-nowrap">
                      {s.billNo}
                    </td>
                    <td
                      className="px-2 py-1.5 text-foreground truncate max-w-[110px]"
                      title={s.customerName}
                    >
                      {s.customerName}
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">
                      {time.format(new Date(s.createdAt))}
                    </td>
                    <td className="px-2 py-1.5 text-right text-foreground tabular-nums">
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
        )}
      </div>
    </div>
  );
}
