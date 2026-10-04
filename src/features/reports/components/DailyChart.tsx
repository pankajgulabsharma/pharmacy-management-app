import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatPaise } from "@/lib/money";

export type DailyPoint = { date: string; amountPaise: number; count: number };

const fmtDay = (iso: string, withWeekday = false) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", {
    ...(withWeekday ? { weekday: "short" as const } : {}),
    day: "2-digit",
    month: "short",
  });

const rupeeTick = (v: number) =>
  v >= 100000
    ? `₹${(v / 100000).toFixed(1)}L`
    : v >= 1000
      ? `₹${(v / 1000).toFixed(1)}k`
      : `₹${v}`;

type Props = {
  data: DailyPoint[];
  /** "bill" / "invoice" — for the tooltip and legend */
  countLabel: string;
  /** Lighter bars on Sundays, so weekly dips are easy to spot */
  shadeSundays?: boolean;
};

/**
 * Amount per day (bars) + number of bills (line) + the period average
 * (dashed). Built to make ups and downs explainable at a glance.
 */
export function DailyChart({ data, countLabel, shadeSundays = false }: Props) {
  const rows = data.map((p) => ({
    ...p,
    rupees: p.amountPaise / 100,
    label: fmtDay(p.date),
    sunday: new Date(`${p.date}T00:00:00`).getDay() === 0,
  }));
  const hasData = data.some((p) => p.amountPaise > 0);
  const avgRupees = data.length
    ? data.reduce((s, p) => s + p.amountPaise, 0) / data.length / 100
    : 0;

  if (!hasData) {
    return (
      <div className="h-[240px] flex items-center justify-center text-[11px] text-muted-foreground">
        Nothing in this period
      </div>
    );
  }

  return (
    <div>
      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={rows}
            margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
            barCategoryGap="18%"
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="var(--color-border)"
            />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
              interval="preserveStartEnd"
              minTickGap={18}
            />
            <YAxis
              yAxisId="amount"
              axisLine={false}
              tickLine={false}
              width={52}
              tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
              tickFormatter={rupeeTick}
            />
            <YAxis
              yAxisId="count"
              orientation="right"
              hide
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ fill: "var(--color-muted)", opacity: 0.6 }}
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as
                  (DailyPoint & { sunday: boolean }) | undefined;
                if (!active || !p) return null;
                const diff = avgRupees
                  ? Math.round(
                      ((p.amountPaise / 100 - avgRupees) / avgRupees) * 100,
                    )
                  : 0;
                return (
                  <div className="rounded-lg border border-border bg-popover px-2.5 py-1.5 text-[11px] shadow-md">
                    <p className="font-medium">{fmtDay(p.date, true)}</p>
                    <p className="tabular-nums">
                      ₹{formatPaise(p.amountPaise)}
                    </p>
                    <p className="text-muted-foreground">
                      {p.count} {countLabel}
                      {p.count === 1 ? "" : "s"}
                    </p>
                    <p
                      className={
                        diff >= 0 ? "text-emerald-600" : "text-red-500"
                      }
                    >
                      {diff >= 0 ? "+" : ""}
                      {diff}% vs average
                    </p>
                  </div>
                );
              }}
            />
            <ReferenceLine
              yAxisId="amount"
              y={avgRupees}
              stroke="var(--color-muted-foreground)"
              strokeDasharray="4 4"
              ifOverflow="extendDomain"
            />
            <Bar
              yAxisId="amount"
              dataKey="rupees"
              radius={[4, 4, 0, 0]}
              maxBarSize={36}
            >
              {rows.map((r) => (
                <Cell
                  key={r.date}
                  fill="var(--color-primary)"
                  fillOpacity={shadeSundays && r.sunday ? 0.35 : 1}
                />
              ))}
            </Bar>
            <Line
              yAxisId="count"
              type="monotone"
              dataKey="count"
              stroke="#f59e0b"
              strokeWidth={1.75}
              dot={
                rows.length <= 31
                  ? { r: 2.5, fill: "#f59e0b", strokeWidth: 0 }
                  : false
              }
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend — what each mark means */}
      <ul className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
        <li className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-primary" />
          Amount per day
        </li>
        {shadeSundays ? (
          <li className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-primary/35" />
            Sundays
          </li>
        ) : null}
        <li className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-amber-500" />
          Number of {countLabel}s
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span className="w-4 border-t border-dashed border-muted-foreground" />
          Average ₹{formatPaise(Math.round(avgRupees * 100))}/day
        </li>
      </ul>
    </div>
  );
}
