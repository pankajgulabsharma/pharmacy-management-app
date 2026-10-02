import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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

type Range = "7d" | "30d";

const SALES_COLOR = "#4f46e5"; // primary indigo
const BILLS_COLOR = "#10b981"; // success green (status only)

const data7d = [
  { date: "10 Apr", sales: 12500, bills: 22 },
  { date: "11 Apr", sales: 15800, bills: 28 },
  { date: "12 Apr", sales: 18200, bills: 34 },
  { date: "13 Apr", sales: 14900, bills: 26 },
  { date: "14 Apr", sales: 17600, bills: 31 },
  { date: "15 Apr", sales: 16800, bills: 29 },
  { date: "16 Apr", sales: 18750, bills: 32 },
];

const data30d = [
  { date: "18 Mar", sales: 11200, bills: 20 },
  { date: "22 Mar", sales: 13400, bills: 24 },
  { date: "26 Mar", sales: 15100, bills: 27 },
  { date: "30 Mar", sales: 12800, bills: 23 },
  { date: "03 Apr", sales: 16200, bills: 30 },
  { date: "07 Apr", sales: 14500, bills: 25 },
  { date: "11 Apr", sales: 17100, bills: 31 },
  { date: "16 Apr", sales: 18750, bills: 32 },
];

function ChartTooltip({ active, payload, label }: any) {
  const { t } = useTranslation();
  if (!active || !payload?.length) return null;
  const sales = payload.find((p: any) => p.dataKey === "sales")?.value;
  const bills = payload.find((p: any) => p.dataKey === "bills")?.value;

  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-xl">
      <p className="text-[11px] font-semibold text-foreground mb-1.5">
        {label}
      </p>
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-[11px]">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: SALES_COLOR }}
          />
          <span className="text-muted-foreground">{t("sales.sales")}</span>
          <span className="font-semibold text-foreground ml-auto">
            ₹{Number(sales || 0).toLocaleString()}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: BILLS_COLOR }}
          />
          <span className="text-muted-foreground">{t("sales.billsShort")}</span>
          <span className="font-semibold text-foreground ml-auto">{bills}</span>
        </div>
      </div>
    </div>
  );
}

export function SalesOverview() {
  const { t } = useTranslation();
  const [range, setRange] = useState<Range>("7d");
  const chartData = useMemo(() => (range === "7d" ? data7d : data30d), [range]);

  return (
    <div className="bg-card border border-border rounded-xl p-3 h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between mb-1 shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="text-xs font-semibold text-foreground">
            {t("sales.title")}
          </h3>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: SALES_COLOR }}
              />
              {t("sales.amount")}
            </span>
            <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: BILLS_COLOR }}
              />
              {t("sales.bills")}
            </span>
          </div>
        </div>
        <select
          value={range}
          onChange={(e) => setRange(e.target.value as Range)}
          className="text-[10px] border border-border rounded-lg px-2 py-1 bg-background text-foreground outline-none focus:ring-1 focus:ring-border cursor-pointer"
        >
          <option value="7d">{t("sales.last7")}</option>
          <option value="30d">{t("sales.last30")}</option>
        </select>
      </div>

      <div className="flex-1 min-h-0 w-full pt-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
            barCategoryGap="18%"
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#e2e8f0"
            />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: "#64748b" }}
              dy={4}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: "#64748b" }}
              tickFormatter={(v) => `₹${v / 1000}k`}
              width={40}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ fill: "#f1f5f9", opacity: 0.7 }}
            />
            <Bar
              dataKey="sales"
              fill={SALES_COLOR}
              radius={[6, 6, 0, 0]}
              maxBarSize={36}
            />
            <Line
              type="monotone"
              dataKey="bills"
              stroke={BILLS_COLOR}
              strokeWidth={2.5}
              dot={{ r: 4, fill: BILLS_COLOR, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: BILLS_COLOR }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
