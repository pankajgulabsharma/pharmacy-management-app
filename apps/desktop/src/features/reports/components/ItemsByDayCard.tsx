import { useDeferredValue, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Download, Search } from "lucide-react";
import type { Sale, SaleReturn } from "@medicare/domain/billing/types";
import { formatPaise, inrFromPaise } from "@medicare/domain/lib/money";
import { plural } from "@medicare/domain/lib/format";
import type { DateRange } from "@medicare/domain/reports/period";
import {
  returnedByDay,
  soldByDay,
  wholePeriod,
  type DayItems,
  type ItemRow,
} from "@medicare/domain/reports/itemsByDay";
import { downloadText, toCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";
import { tr } from "@/lib/i18n";
import { ReportCard } from "./ReportTable";

type Kind = "sold" | "returned";
type View = "days" | "total";

const dayLabel = new Intl.DateTimeFormat("en-IN", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
});
/** "2026-10-15" → "Thu, 15 Oct 2026" (local day, no timezone shift) */
const formatDay = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return dayLabel.format(new Date(y, m - 1, d));
};
const qtyText = (r: ItemRow) =>
  [
    r.qtyStrip ? `${r.qtyStrip} ${r.unit}` : "",
    r.qtyLoose ? `${r.qtyLoose} LSE` : "",
  ]
    .filter(Boolean)
    .join(" + ");

/**
 * Every medicine sold (or returned) in the chosen period — day by day
 * with the date on top, or added up for the whole period. Search, fold a
 * day, export to Excel.
 */
export function ItemsByDayCard({
  sales,
  saleReturns,
  range,
  periodLabel,
}: {
  sales: readonly Sale[];
  saleReturns: readonly SaleReturn[];
  range: DateRange;
  periodLabel: string;
}) {
  const [kind, setKind] = useState<Kind>("sold");
  const [view, setView] = useState<View>("days");
  const [query, setQuery] = useState("");
  const q = useDeferredValue(query).trim().toLowerCase();
  const [folded, setFolded] = useState<Set<string>>(() => new Set());

  const days = useMemo(
    () =>
      kind === "sold"
        ? soldByDay(sales, range)
        : returnedByDay(saleReturns, range),
    [kind, sales, saleReturns, range],
  );
  const groups = useMemo(() => {
    const base =
      view === "days"
        ? days
        : ([wholePeriod(days)].filter(Boolean) as DayItems[]);
    if (!q) return base;
    return base
      .map((d) => ({
        ...d,
        items: d.items.filter((r) => r.name.toLowerCase().includes(q)),
      }))
      .filter((d) => d.items.length > 0);
  }, [days, view, q]);

  const docWord = kind === "sold" ? "bill" : "return";
  const total = groups.reduce(
    (s, d) => s + d.items.reduce((a, r) => a + r.amountPaise, 0),
    0,
  );

  const exportCsv = () =>
    downloadText(
      `medicines-${kind}_${periodLabel}.csv`,
      toCsv(
        groups.flatMap((d) => d.items.map((r) => ({ d, r }))),
        [
          ...(view === "days"
            ? [{ header: "Date", value: (x: { d: DayItems }) => x.d.date }]
            : []),
          { header: "Medicine", value: (x) => x.r.name },
          { header: "Packs", value: (x) => x.r.qtyStrip },
          { header: "Pack unit", value: (x) => x.r.unit },
          { header: "Loose", value: (x) => x.r.qtyLoose },
          {
            header: kind === "sold" ? "Bills" : "Returns",
            value: (x) => x.r.docs,
          },
          { header: "Amount (Rs)", value: (x) => x.r.amountPaise / 100 },
        ],
        { bom: true },
      ),
    );

  const toggle = (date: string) =>
    setFolded((f) => {
      const n = new Set(f);
      if (n.has(date)) n.delete(date);
      else n.add(date);
      return n;
    });

  return (
    <ReportCard
      title={kind === "sold" ? "Medicines sold" : "Medicines returned"}
      subtitle={`${periodLabel} · ${
        view === "days" ? tr("day by day") : tr("whole period")
      }`}
      flush
      action={
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Segmented
            value={kind}
            onChange={setKind}
            options={[
              ["sold", "Sold"],
              ["returned", "Returned"],
            ]}
          />
          <Segmented
            value={view}
            onChange={setView}
            options={[
              ["days", "Day by day"],
              ["total", "Whole period"],
            ]}
          />
          <label className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value.slice(0, 60))}
              placeholder={tr("Find medicine…")}
              aria-label={tr("Find medicine")}
              className="h-7 w-36 rounded-md border border-border bg-background pl-6 pr-2 text-[11px] outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </label>
          <button
            type="button"
            onClick={exportCsv}
            disabled={groups.length === 0}
            className="h-7 rounded-md border border-border px-2 text-[11px] inline-flex items-center gap-1 hover:bg-muted disabled:opacity-50"
          >
            <Download className="h-3 w-3" />
            {tr("Export")}
          </button>
        </div>
      }
    >
      {groups.length === 0 ? (
        <p className="px-3 py-8 text-center text-[11px] text-muted-foreground">
          {q
            ? tr("No medicine matches “{{q}}”.", { q: query.trim() })
            : kind === "sold"
              ? tr("No sales in this period")
              : tr("No customer returns in this period")}
        </p>
      ) : (
        <div className="overflow-auto max-h-[460px]">
          <table className="w-full text-[11px] border-collapse">
            <thead className="sticky top-0 z-20">
              <tr>
                {[
                  ["Medicine", "text-left", ""],
                  ["Quantity", "text-left", "w-[140px]"],
                  [
                    kind === "sold" ? "Bills" : "Returns",
                    "text-right",
                    "w-[80px]",
                  ],
                  ["Amount (₹)", "text-right", "w-[110px]"],
                ].map(([label, align, w]) => (
                  <th
                    key={label}
                    scope="col"
                    className={cn(
                      "h-9 px-3 bg-primary text-primary-foreground text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap",
                      align,
                      w,
                    )}
                  >
                    {tr(label)}
                  </th>
                ))}
              </tr>
            </thead>
            {groups.map((d) => {
              const open = !folded.has(d.date);
              return (
                <tbody key={d.date || "all"}>
                  {view === "days" ? (
                    <tr
                      className="cursor-pointer bg-muted/60 hover:bg-muted border-y border-border"
                      onClick={() => toggle(d.date)}
                    >
                      <td colSpan={4} className="px-3 py-1.5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                            {open ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )}
                            {formatDay(d.date)}
                          </span>
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            {plural(d.docs, docWord)} ·{" "}
                            {plural(d.items.length, "medicine")} ·{" "}
                            <b className="text-foreground">
                              {inrFromPaise(d.amountPaise)}
                            </b>
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                  {open
                    ? d.items.map((r) => (
                        <tr
                          key={r.medicineId}
                          className="border-b border-border/50 hover:bg-muted/30"
                        >
                          <td className="px-3 py-1.5 pl-8 font-medium">
                            {r.name}
                          </td>
                          <td className="px-3 py-1.5 tabular-nums">
                            {qtyText(r)}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                            {r.docs}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums">
                            {formatPaise(r.amountPaise)}
                          </td>
                        </tr>
                      ))
                    : null}
                </tbody>
              );
            })}
            <tfoot className="sticky bottom-0 z-20">
              <tr className="border-t-2 border-border bg-muted font-semibold">
                <td className="px-3 py-2" colSpan={3}>
                  {tr("Total")}
                  {q ? ` · “${query.trim()}”` : ""}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatPaise(total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </ReportCard>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: [T, string][];
}) {
  return (
    <div
      role="radiogroup"
      className="inline-flex h-7 rounded-md border border-border p-0.5 bg-muted/40"
    >
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cn(
            "px-2 rounded text-[11px] font-medium transition-colors",
            value === v
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {tr(label)}
        </button>
      ))}
    </div>
  );
}
