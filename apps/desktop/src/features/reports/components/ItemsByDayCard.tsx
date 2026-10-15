import { useDeferredValue, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Download,
  Search,
} from "lucide-react";
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
import { Segmented } from "@/components/common/Segmented";

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
  // Days start closed — open the ones you want (or all at once)
  const [opened, setOpened] = useState<Set<string>>(() => new Set());

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
  const allOpen = groups.length > 0 && groups.every((d) => opened.has(d.date));
  const total = groups.reduce((s, d) => s + d.amountPaise, 0);
  // Bills are rounded to the rupee — shown so the total meets "Billed"
  const all = !q && groups.length ? groups : null;
  const billed = all ? all.reduce((s, d) => s + d.billedPaise, 0) : 0;
  const roundOff = all ? billed - total : 0;

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
    setOpened((f) => {
      const n = new Set(f);
      if (n.has(date)) n.delete(date);
      else n.add(date);
      return n;
    });

  // Columns: name grows; the rest fixed. Last column keeps clear of the
  // scrollbar (stable gutter + extra right padding).
  const COLS = [
    { label: "Medicine", cls: "text-left pl-4" },
    { label: "Quantity", cls: "text-left w-[150px]" },
    {
      label: kind === "sold" ? "Bills" : "Returns",
      cls: "text-right w-[90px]",
    },
    { label: "Amount (₹)", cls: "text-right w-[140px] pr-6" },
  ];

  return (
    <ReportCard
      title={kind === "sold" ? "Medicines sold" : "Medicines returned"}
      subtitle={`${periodLabel} · ${
        view === "days" ? tr("day by day") : tr("whole period")
      }`}
      flush
      action={
        <div className="flex flex-wrap items-center justify-end gap-2">
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
          {view === "days" && groups.length > 1 && !q ? (
            <button
              type="button"
              onClick={() =>
                setOpened(
                  allOpen ? new Set() : new Set(groups.map((d) => d.date)),
                )
              }
              className="h-8 rounded-lg border border-border px-2.5 text-[11px] font-medium text-foreground inline-flex items-center gap-1.5 hover:bg-muted"
            >
              {allOpen ? (
                <ChevronsDownUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronsUpDown className="h-3.5 w-3.5" />
              )}
              {tr(allOpen ? "Collapse all" : "Expand all")}
            </button>
          ) : null}
          <label className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value.slice(0, 60))}
              placeholder={tr("Find medicine…")}
              aria-label={tr("Find medicine")}
              className="h-8 w-44 rounded-lg border border-border bg-background pl-8 pr-2 text-[11px] outline-none transition-colors focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/20"
            />
          </label>
          <button
            type="button"
            onClick={exportCsv}
            disabled={groups.length === 0}
            className="h-8 rounded-lg border border-primary/30 bg-primary/5 px-3 text-[11px] font-medium text-primary inline-flex items-center gap-1.5 transition-colors hover:bg-primary/10 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            {tr("Export")}
          </button>
        </div>
      }
    >
      {groups.length === 0 ? (
        <p className="px-3 py-10 text-center text-[11px] text-muted-foreground">
          {q
            ? tr("No medicine matches “{{q}}”.", { q: query.trim() })
            : kind === "sold"
              ? tr("No sales in this period")
              : tr("No customer returns in this period")}
        </p>
      ) : (
        <div className="overflow-auto max-h-[480px] [scrollbar-gutter:stable]">
          <table className="w-full text-[11.5px] border-collapse">
            <thead className="sticky top-0 z-20">
              <tr>
                {COLS.map((c) => (
                  <th
                    key={c.label}
                    scope="col"
                    className={cn(
                      "h-9 px-3 bg-primary text-primary-foreground text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap",
                      c.cls,
                    )}
                  >
                    {tr(c.label)}
                  </th>
                ))}
              </tr>
            </thead>
            {groups.map((d) => {
              // whole period has one group; a search shows what it found
              const open = view === "total" || !!q || opened.has(d.date);
              return (
                <tbody key={d.date || "all"}>
                  {view === "days" ? (
                    <tr
                      className="cursor-pointer select-none bg-primary/[0.06] hover:bg-primary/10 border-y border-primary/15"
                      onClick={() => toggle(d.date)}
                      aria-expanded={open}
                    >
                      <td colSpan={3} className="pl-3 pr-3 py-2">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                          {open ? (
                            <ChevronDown className="h-3.5 w-3.5 text-primary" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-primary" />
                          )}
                          {formatDay(d.date)}
                          <span className="ml-2 font-normal text-[10.5px] text-muted-foreground">
                            {plural(d.docs, docWord)} ·{" "}
                            {plural(d.items.length, "medicine")}
                          </span>
                        </span>
                      </td>
                      <td className="pl-3 pr-6 py-2 text-right tabular-nums font-semibold text-primary whitespace-nowrap">
                        {inrFromPaise(d.amountPaise)}
                      </td>
                    </tr>
                  ) : null}
                  {open
                    ? d.items.map((r, i) => (
                        <tr
                          key={r.medicineId}
                          className={cn(
                            "border-b border-border/40 hover:bg-muted/40",
                            i % 2 === 1 && "bg-muted/15",
                          )}
                        >
                          <td
                            className={cn(
                              "py-2 pr-3 font-medium text-foreground",
                              view === "days" ? "pl-9" : "pl-4",
                            )}
                          >
                            {r.name}
                          </td>
                          <td className="px-3 py-2 tabular-nums text-foreground/80 whitespace-nowrap">
                            {qtyText(r)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                            {r.docs}
                          </td>
                          <td className="pl-3 pr-6 py-2 text-right tabular-nums font-medium text-foreground whitespace-nowrap">
                            {formatPaise(r.amountPaise)}
                          </td>
                        </tr>
                      ))
                    : null}
                </tbody>
              );
            })}
            <tfoot className="sticky bottom-0 z-20">
              <tr className="bg-card border-t-2 border-primary/30 [&>td]:bg-primary/10">
                <td className="pl-4 pr-3 py-2.5" colSpan={3}>
                  <span className="text-[12px] font-semibold text-foreground">
                    {tr("Total")}
                    {q ? ` · “${query.trim()}”` : ""}
                  </span>
                  {all && roundOff !== 0 ? (
                    <span className="ml-2 text-[10px] text-muted-foreground">
                      {tr("+ round-off on bills {{r}} = {{b}}", {
                        r: inrFromPaise(roundOff),
                        b: inrFromPaise(billed),
                      })}
                    </span>
                  ) : null}
                </td>
                <td className="pl-3 pr-6 py-2.5 text-right tabular-nums text-[13px] font-bold text-primary whitespace-nowrap">
                  {inrFromPaise(total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </ReportCard>
  );
}
