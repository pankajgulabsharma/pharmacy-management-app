import type { ReactNode } from "react";
import {
  CalendarDays,
  Info,
  TrendingDown,
  TrendingUp,
  Trophy,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { inrRounded as inrFromPaise } from "@/lib/money";
import { WEEKDAYS, type SalesInsights } from "../utils/reports";
import { ReportCard } from "./ReportTable";

const fmt = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });

const FULL_DAY = [
  "Sundays",
  "Mondays",
  "Tuesdays",
  "Wednesdays",
  "Thursdays",
  "Fridays",
  "Saturdays",
];

/**
 * Explains the chart in plain words. Every line is computed from the data;
 * a line only appears when there is enough data for it to be true.
 */
export function SalesInsightsCard({ i }: { i: SalesInsights }) {
  const maxWeekday = Math.max(0, ...i.weekday.map((v) => v ?? 0));
  const hasWeekdays = i.busiestWeekday !== null && i.quietestWeekday !== null;

  return (
    <ReportCard
      title="Why the chart goes up and down"
      subtitle={`Average ${inrFromPaise(i.avgPerDayPaise)} per day`}
    >
      <ul className="space-y-2.5 text-[11px] leading-snug">
        {hasWeekdays ? (
          <Point icon={<CalendarDays className="h-3.5 w-3.5" />} tone="primary">
            <b>{FULL_DAY[i.busiestWeekday!]}</b> are busiest (avg{" "}
            {inrFromPaise(i.weekday[i.busiestWeekday!] ?? 0)}),{" "}
            <b>{FULL_DAY[i.quietestWeekday!]}</b> quietest (avg{" "}
            {inrFromPaise(i.weekday[i.quietestWeekday!] ?? 0)}) — the regular
            weekly dips in the chart.
          </Point>
        ) : null}

        {i.salaryLiftPct !== null && Math.abs(i.salaryLiftPct) >= 5 ? (
          <Point
            icon={<Wallet className="h-3.5 w-3.5" />}
            tone={i.salaryLiftPct > 0 ? "good" : "bad"}
          >
            Salary days (<b>1st–5th</b>) sell{" "}
            <b>
              {Math.abs(i.salaryLiftPct)}%{" "}
              {i.salaryLiftPct > 0 ? "more" : "less"}
            </b>{" "}
            than other days — the small hump at each month start.
          </Point>
        ) : null}

        {i.trendPct !== null && Math.abs(i.trendPct) >= 3 ? (
          <Point
            icon={
              i.trendPct > 0 ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )
            }
            tone={i.trendPct > 0 ? "good" : "bad"}
          >
            The second half of this period is{" "}
            <b>
              {Math.abs(i.trendPct)}% {i.trendPct > 0 ? "higher" : "lower"}
            </b>{" "}
            than the first half
            {i.trendPct > 0
              ? " — seasonal demand (fever / cold) is rising."
              : "."}
          </Point>
        ) : null}

        {i.best && i.worst ? (
          <Point icon={<Trophy className="h-3.5 w-3.5" />} tone="primary">
            Best day <b>{fmt(i.best.date)}</b> (
            {inrFromPaise(i.best.amountPaise)}); lowest{" "}
            <b>{fmt(i.worst.date)}</b> ({inrFromPaise(i.worst.amountPaise)}).
          </Point>
        ) : null}

        {!hasWeekdays ? (
          <Point icon={<Info className="h-3.5 w-3.5" />} tone="muted">
            Choose <b>Last 30 days</b> or <b>Last 3 months</b> to see weekly and
            monthly patterns.
          </Point>
        ) : null}
      </ul>

      {hasWeekdays ? (
        <div className="mt-3 border-t border-border pt-3">
          <p className="text-[10px] text-muted-foreground mb-1.5">
            Average sales by weekday
          </p>
          <div
            className="grid grid-cols-7 gap-1.5 items-end h-[72px]"
            aria-label="Average sales by weekday"
          >
            {WEEKDAYS.map((d, idx) => {
              const v = i.weekday[idx] ?? 0;
              const h = maxWeekday
                ? Math.max(6, Math.round((v / maxWeekday) * 52))
                : 6;
              return (
                <div
                  key={d}
                  className="flex flex-col items-center gap-1"
                  title={`${d}: ${inrFromPaise(v)}`}
                >
                  <div
                    className={cn(
                      "w-full rounded-t",
                      idx === i.busiestWeekday
                        ? "bg-primary"
                        : idx === i.quietestWeekday
                          ? "bg-primary/30"
                          : "bg-primary/60",
                    )}
                    style={{ height: h }}
                  />
                  <span
                    className={cn(
                      "text-[9px]",
                      idx === i.busiestWeekday
                        ? "font-semibold text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {d}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </ReportCard>
  );
}

function Point({
  icon,
  tone,
  children,
}: {
  icon: ReactNode;
  tone: "primary" | "good" | "bad" | "muted";
  children: ReactNode;
}) {
  return (
    <li className="flex gap-2">
      <span
        className={cn(
          "mt-px h-5 w-5 shrink-0 rounded-md flex items-center justify-center",
          tone === "primary" && "bg-primary/10 text-primary",
          tone === "good" && "bg-emerald-500/10 text-emerald-600",
          tone === "bad" && "bg-red-500/10 text-red-500",
          tone === "muted" && "bg-muted text-muted-foreground",
        )}
      >
        {icon}
      </span>
      <span className="text-foreground/90">{children}</span>
    </li>
  );
}
