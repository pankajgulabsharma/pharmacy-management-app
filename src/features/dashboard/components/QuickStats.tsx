import { Link } from "react-router-dom";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import type { DashboardData } from "../hooks/useDashboardData";
import { tr } from "@/lib/i18n";

/** Stock health by medicine — each row opens Inventory filtered to it */
export function QuickStats({ d }: { d: DashboardData }) {
  const rows = [
    {
      key: "in",
      label: "In stock",
      value: d.health.inStock,
      color: "#4f46e5",
      to: "/medicines?status=in_stock",
    },
    {
      key: "low",
      label: "Low stock",
      value: d.health.low,
      color: "#f59e0b",
      to: "/medicines?status=low_only",
    },
    {
      key: "out",
      label: "Out of stock",
      value: d.health.out,
      color: "#ef4444",
      to: "/medicines?status=out",
    },
  ];
  const total = rows.reduce((s, r) => s + r.value, 0) || 1;
  const health = Math.round((d.health.inStock / total) * 100);

  return (
    <div className="bg-card border border-border rounded-xl p-3 h-full flex flex-col overflow-hidden">
      <h3 className="text-xs font-semibold text-foreground shrink-0 mb-2">
        {tr("Stock health")}
      </h3>
      <div className="flex-1 min-h-0 flex items-center gap-2.5">
        <div className="relative h-[78px] w-[78px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={rows}
                dataKey="value"
                cx="50%"
                cy="50%"
                innerRadius={24}
                outerRadius={35}
                paddingAngle={2}
                strokeWidth={0}
              >
                {rows.map((r) => (
                  <Cell key={r.key} fill={r.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-sm font-bold text-foreground leading-none">
              {health}%
            </span>
            <span className="text-[8px] text-muted-foreground mt-0.5">
              healthy
            </span>
          </div>
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          {rows.map((r) => (
            <Link
              key={r.key}
              to={r.to}
              className="flex items-center gap-2 rounded-lg bg-muted/50 px-2 py-1.5 hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: r.color }}
              />
              <span className="text-[10px] text-foreground flex-1 whitespace-nowrap">
                {tr(r.label)}
              </span>
              <span className="text-[10px] font-semibold tabular-nums">
                {r.value}
              </span>
              <span className="text-[9px] text-muted-foreground tabular-nums w-7 text-right">
                {Math.round((r.value / total) * 100)}%
              </span>
            </Link>
          ))}
          <p className="text-[9px] text-muted-foreground">
            {tr("Active medicines · click to see them")}
          </p>
        </div>
      </div>
    </div>
  );
}
