import { useTranslation } from "react-i18next";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

export function QuickStats() {
  const { t } = useTranslation();

  const data = [
    { nameKey: "quickStats.inStock", value: 1248, color: "#4f46e5" }, // indigo primary
    { nameKey: "quickStats.lowStock", value: 18, color: "#f59e0b" }, // warning
    { nameKey: "quickStats.outOfStock", value: 6, color: "#ef4444" }, // danger
  ];

  const total = data.reduce((sum, item) => sum + item.value, 0);
  const health = Math.round((data[0].value / total) * 100);

  return (
    <div className="bg-card border border-border rounded-xl p-3 h-full flex flex-col overflow-hidden">
      <h3 className="text-xs font-semibold text-foreground shrink-0 mb-2">
        {t("quickStats.title")}
      </h3>

      <div className="flex-1 min-h-0 flex items-center gap-2.5">
        <div className="relative h-[78px] w-[78px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                cx="50%"
                cy="50%"
                innerRadius={24}
                outerRadius={35}
                paddingAngle={2}
                strokeWidth={0}
              >
                {data.map((entry) => (
                  <Cell key={entry.nameKey} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-sm font-bold text-foreground leading-none">
              {health}%
            </span>
            <span className="text-[8px] text-muted-foreground mt-0.5">
              {t("quickStats.health")}
            </span>
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-1">
          {data.map((item) => {
            const percent = Math.round((item.value / total) * 100);
            return (
              <div
                key={item.nameKey}
                className="flex items-center gap-2 rounded-lg bg-muted/50 px-2 py-1.5"
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] text-muted-foreground truncate">
                      {t(item.nameKey)}
                    </span>
                    <span className="text-[10px] font-semibold text-foreground tabular-nums">
                      {item.value.toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-1 h-1 w-full rounded-full bg-border/60 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(percent, 2)}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
