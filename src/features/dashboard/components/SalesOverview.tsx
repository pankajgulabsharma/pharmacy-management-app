import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { inrRounded } from "@/lib/money";
import { ChartTooltipCard } from "@/components/common/ChartTooltipCard";
import type { DashboardData } from "../hooks/useDashboardData";
import { ViewAll } from "./DashLink";

type Range = "7d" | "30d";

const label = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });

/** Live sales trend; click a bar (or "Open report") for the full report */
export function SalesOverview({ d }: { d: DashboardData }) {
  const navigate = useNavigate();
  const [range, setRange] = useState<Range>("7d");
  const report = range === "7d" ? d.week : d.month;
  const data = report.daily.map((p) => ({
    date: label(p.date),
    full: new Date(`${p.date}T00:00:00`).toLocaleDateString("en-IN", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    sales: p.amountPaise / 100,
    bills: p.count,
  }));

  return (
    <div className="bg-card border border-border rounded-xl p-3 h-full flex flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-2 shrink-0">
        <div>
          <h3 className="text-xs font-semibold text-foreground">
            Sales overview
          </h3>
          <p className="text-[10px] text-muted-foreground">
            {inrRounded(report.netAfterReturnsPaise)} · {report.billCount} bills
            ·{" "}
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-primary" /> amount
            </span>{" "}
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> bills
            </span>
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <select
            value={range}
            onChange={(e) => setRange(e.target.value === "30d" ? "30d" : "7d")}
            aria-label="Chart period"
            className="text-[10px] border border-border rounded-lg px-2 py-1 bg-background text-foreground outline-none focus:ring-1 focus:ring-ring cursor-pointer"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
          <ViewAll to={`/reports?tab=sales&period=${range}`}>
            Open report
          </ViewAll>
        </div>
      </div>

      <div className="flex-1 min-h-0 w-full pt-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
            barCategoryGap="18%"
            onClick={() => navigate(`/reports?tab=sales&period=${range}`)}
            className="cursor-pointer"
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="var(--color-border)"
            />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
              interval="preserveStartEnd"
              minTickGap={14}
              dy={4}
            />
            <YAxis
              yAxisId="a"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
              tickFormatter={(v: number) =>
                v >= 1000 ? `₹${(v / 1000).toFixed(1)}k` : `₹${v}`
              }
              width={44}
            />
            <YAxis yAxisId="b" orientation="right" hide allowDecimals={false} />
            <Tooltip
              cursor={{ fill: "var(--color-muted)", opacity: 0.6 }}
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as
                  (typeof data)[number] | undefined;
                if (!active || !p) return null;
                // Only what matters: the day, its sales and its bills
                return (
                  <ChartTooltipCard
                    title={p.full}
                    rows={[
                      {
                        color: "var(--color-primary)",
                        label: "Sales",
                        value: inrRounded(Math.round(p.sales * 100)),
                      },
                      {
                        color: "#10b981",
                        label: "Bills",
                        value: String(p.bills),
                        marker: "line",
                      },
                    ]}
                  />
                );
              }}
            />
            <Bar
              yAxisId="a"
              dataKey="sales"
              fill="var(--color-primary)"
              radius={[6, 6, 0, 0]}
              maxBarSize={36}
            />
            <Line
              yAxisId="b"
              type="monotone"
              dataKey="bills"
              stroke="#10b981"
              strokeWidth={2}
              dot={
                range === "7d"
                  ? { r: 3.5, fill: "#10b981", strokeWidth: 0 }
                  : false
              }
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
