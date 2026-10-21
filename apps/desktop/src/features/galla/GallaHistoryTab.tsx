import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Banknote } from "lucide-react";
import { differenceOf } from "@medicare/domain/cash/galla";
import { inrFromPaise } from "@medicare/domain/lib/money";
import { toISODate } from "@medicare/domain/lib/date";
import type { DateRange } from "@medicare/domain/reports/period";
import { EmptyState } from "@/components/common/EmptyState";
import { useGallaHistory } from "./gallaHistory";
import { tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { DiffBadge } from "./parts";

export function GallaHistoryTab({
  range,
  periodLabel,
}: {
  range: DateRange;
  periodLabel: string;
}) {
  const from = toISODate(range.from);
  const to = toISODate(range.to);
  const { days, perCounter, load } = useGallaHistory();
  useEffect(() => {
    void load(from, to).catch(() => {});
  }, [load, from, to]);

  const closed = days.filter((d) => d.status === "closed");
  const short = closed.reduce(
    (a, d) => a + Math.min(0, differenceOf(d) ?? 0),
    0,
  );
  const excess = closed.reduce(
    (a, d) => a + Math.max(0, differenceOf(d) ?? 0),
    0,
  );
  const takenOut = closed.reduce(
    (a, d) => a + ((d.countedPaise ?? 0) - (d.keptPaise ?? 0)),
    0,
  );

  if (days.length === 0)
    return (
      <EmptyState
        icon={Banknote}
        title="No galla days in this period"
        description="Start the day in Galla / Day close: opening cash in the morning, count and close at night."
      />
    );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {[
          ["Days closed", `${closed.length} / ${days.length}`, ""],
          [
            "Short (total)",
            inrFromPaise(-short),
            short < 0 ? "text-rose-600 dark:text-rose-400" : "",
          ],
          [
            "Excess (total)",
            inrFromPaise(excess),
            excess > 0 ? "text-sky-600 dark:text-sky-400" : "",
          ],
          ["Taken out (owner / bank)", inrFromPaise(takenOut), ""],
        ].map(([k, v, c]) => (
          <div
            key={k}
            className="rounded-xl border border-border bg-card px-3 py-2.5"
          >
            <p className="text-[10.5px] text-muted-foreground">{tr(k)}</p>
            <p className={cn("text-[15px] font-bold tabular-nums", c)}>{v}</p>
          </div>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border bg-card">
        <table className="w-full text-[12px]">
          <caption className="sr-only">{periodLabel}</caption>
          <thead className="sticky top-0 bg-primary text-[10.5px] uppercase tracking-wide text-primary-foreground">
            <tr>
              <th className="px-3 py-2 text-left">{tr("Day")}</th>
              {perCounter ? (
                <th className="px-3 py-2 text-left">{tr("Counter")}</th>
              ) : null}
              <th className="px-3 py-2 text-right">{tr("Opening")}</th>
              <th className="px-3 py-2 text-right">{tr("Should be")}</th>
              <th className="px-3 py-2 text-right">{tr("Counted")}</th>
              <th className="px-3 py-2 text-left">{tr("Difference")}</th>
              <th className="px-3 py-2 text-right">{tr("Taken out")}</th>
              <th className="px-3 py-2 text-left">{tr("Closed by")}</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const diff = differenceOf(d);
              return (
                <tr
                  key={d.id}
                  className="border-t border-border/60 hover:bg-muted/30"
                >
                  <td className="px-3 py-2">
                    <Link
                      to={`/galla?date=${d.date}${d.counter ? `&counter=${encodeURIComponent(d.counter)}` : ""}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {new Date(`${d.date}T00:00`).toLocaleDateString("en-IN", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                    </Link>
                  </td>
                  {perCounter ? (
                    <td className="px-3 py-2">{d.counter}</td>
                  ) : null}
                  <td className="px-3 py-2 text-right tabular-nums">
                    {inrFromPaise(d.openingPaise)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {d.expectedPaise === null
                      ? "—"
                      : inrFromPaise(d.expectedPaise)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {d.countedPaise === null
                      ? "—"
                      : inrFromPaise(d.countedPaise)}
                  </td>
                  <td className="px-3 py-2">
                    {diff === null ? (
                      <span className="text-[11px] text-amber-600">
                        {tr("Not closed")}
                      </span>
                    ) : (
                      <DiffBadge paise={diff} />
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {d.countedPaise !== null && d.keptPaise !== null
                      ? inrFromPaise(d.countedPaise - d.keptPaise)
                      : "—"}
                  </td>
                  <td className="max-w-[220px] px-3 py-2">
                    <p className="truncate">{d.closedBy || "—"}</p>
                    {d.note ? (
                      <p
                        className="truncate text-[10.5px] text-muted-foreground"
                        title={d.note}
                      >
                        {d.note}
                      </p>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
