import { Fragment, type RefObject } from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { tr } from "@/lib/i18n";
import { CodeChip } from "@/components/common/CodeChip";
import { SELECTED_ROW } from "@/hooks/useListNavigation";
import { inrFromPaise } from "@medicare/domain/lib/money";
import { toISODate } from "@medicare/domain/lib/date";
import { plural } from "@medicare/domain/lib/format";
import {
  REFUND_MODE_LABELS,
  type Sale,
  type SaleReturn,
} from "@medicare/domain/billing/types";

const dayLabel = new Intl.DateTimeFormat("en-IN", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const time = new Intl.DateTimeFormat("en-IN", {
  hour: "2-digit",
  minute: "2-digit",
});
const dayOf = (iso: string) => toISODate(new Date(iso));

/** "Today · Thu, 15 Oct 2026" */
function dayTitle(ymd: string) {
  const today = toISODate(new Date());
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const [yy, mm, dd] = ymd.split("-").map(Number);
  const label = dayLabel.format(new Date(yy, mm - 1, dd));
  if (ymd === today) return `${tr("Today")} · ${label}`;
  if (ymd === toISODate(y)) return `${tr("Yesterday")} · ${label}`;
  return label;
}

/** Rows grouped under their date (list is newest first) */
function byDay<T>(rows: readonly T[], at: (r: T) => string) {
  const out: { date: string; rows: T[] }[] = [];
  for (const r of rows) {
    const d = dayOf(at(r));
    if (out.at(-1)?.date !== d) out.push({ date: d, rows: [] });
    out.at(-1)!.rows.push(r);
  }
  return out;
}

const TH =
  "px-3 py-2 text-left text-[10px] font-semibold uppercase bg-primary text-primary-foreground";

function DayRow({
  date,
  cols,
  summary,
}: {
  date: string;
  cols: number;
  summary: string;
}) {
  return (
    <tr className="bg-muted/70 border-y border-border">
      <td colSpan={cols} className="px-3 py-1.5">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
            {dayTitle(date)}
          </span>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {summary}
          </span>
        </div>
      </td>
    </tr>
  );
}

/** Bills to return from — date on top, newest first */
export function BillPickList({
  bills,
  selectedId,
  onPick,
  listRef,
  footer,
}: {
  bills: readonly Sale[];
  selectedId: string | null;
  onPick: (s: Sale) => void;
  listRef: RefObject<HTMLDivElement | null>;
  footer?: React.ReactNode;
}) {
  return (
    <div
      ref={listRef}
      className="flex-1 min-h-0 rounded-lg border border-border bg-card overflow-auto"
    >
      <table className="w-full text-[11px]">
        <thead className="sticky top-0 z-10">
          <tr>
            {["Bill", "Customer", "Time", "Items", "Total", "Returned", ""].map(
              (h) => (
                <th key={h || "action"} className={TH}>
                  {tr(h)}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {byDay(bills, (s) => s.createdAt).map((g) => (
            <Fragment key={g.date}>
              <DayRow
                date={g.date}
                cols={7}
                summary={`${plural(g.rows.length, "bill")} · ${inrFromPaise(
                  g.rows.reduce((t, s) => t + s.totals.netPaise, 0),
                )}`}
              />
              {g.rows.map((s) => {
                const full = s.returnedPaise >= s.totals.netPaise;
                return (
                  <tr
                    key={s.id}
                    data-row-id={s.id}
                    aria-selected={selectedId === s.id}
                    className={cn(
                      "border-b border-border/50 hover:bg-primary/5 cursor-pointer bg-card",
                      full && "opacity-60",
                      selectedId === s.id && SELECTED_ROW,
                    )}
                    onClick={() => onPick(s)}
                  >
                    <td className="px-3 py-2">
                      <CodeChip>{s.billNo}</CodeChip>
                    </td>
                    <td className="px-3 py-2">{s.customerName}</td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap tabular-nums">
                      {time.format(new Date(s.createdAt))}
                    </td>
                    <td className="px-3 py-2">{s.lines.length}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {inrFromPaise(s.totals.netPaise)}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">
                      {full
                        ? tr("All returned")
                        : s.returnedPaise
                          ? inrFromPaise(s.returnedPaise)
                          : "—"}
                    </td>
                    <td className="px-3 py-2 text-primary text-[10px] font-medium">
                      {full ? "" : tr("Select")}
                    </td>
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
      {footer}
    </div>
  );
}

/** Returns already made — date on top, newest first */
export function ReturnsDoneList({
  returns,
  onOpenBill,
  footer,
}: {
  returns: readonly SaleReturn[];
  onOpenBill: (saleId: string) => void;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex-1 min-h-0 rounded-lg border border-border bg-card overflow-auto">
      <table className="w-full text-[11px]">
        <thead className="sticky top-0 z-10">
          <tr>
            {[
              "Return",
              "Against bill",
              "Customer",
              "Time",
              "Medicines",
              "Refund",
              "Mode",
            ].map((h) => (
              <th key={h} className={TH}>
                {tr(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {byDay(returns, (r) => r.createdAt).map((g) => (
            <Fragment key={g.date}>
              <DayRow
                date={g.date}
                cols={7}
                summary={`${plural(g.rows.length, "return")} · ${inrFromPaise(
                  g.rows.reduce((t, r) => t + r.refundPaise, 0),
                )}`}
              />
              {g.rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-border/50 hover:bg-primary/5 cursor-pointer bg-card"
                  title={tr("Open the bill")}
                  onClick={() => onOpenBill(r.saleId)}
                >
                  <td className="px-3 py-2">
                    <CodeChip>{r.returnNo}</CodeChip>
                  </td>
                  <td className="px-3 py-2 font-mono text-[10px]">
                    {r.billNo}
                  </td>
                  <td className="px-3 py-2">{r.customerName}</td>
                  <td className="px-3 py-2 text-muted-foreground tabular-nums">
                    {time.format(new Date(r.createdAt))}
                  </td>
                  <td className="px-3 py-2 max-w-[260px] truncate">
                    {r.lines
                      .filter((l) => l.qtyStrip + l.qtyLoose > 0)
                      .map((l) => l.medicineName)
                      .join(", ")}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {inrFromPaise(r.refundPaise)}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {tr(REFUND_MODE_LABELS[r.refundMode])}
                  </td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
      {footer}
    </div>
  );
}
