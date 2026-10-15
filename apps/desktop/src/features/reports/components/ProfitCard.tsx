import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import type { Sale } from "@medicare/domain/billing/types";
import type { DateRange } from "@medicare/domain/reports/period";
import {
  profitBy,
  type ProfitRow,
} from "@medicare/domain/reports/stockInsights";
import { formatPaise } from "@medicare/domain/lib/money";
import { useMedicineStore } from "@/features/medicines/store/useMedicineStore";
import { useInventoryStore } from "@/features/inventory/store/useInventoryStore";
import { Segmented } from "@/components/common/Segmented";
import { downloadText, toCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";
import { tr } from "@/lib/i18n";
import { ReportTable } from "./ReportTable";

const SHOWN = 100;

/**
 * Which medicines and companies actually make money — and which sell a
 * lot at a thin margin (worth asking the distributor for a better rate).
 */
export function ProfitCard({
  sales,
  range,
  periodLabel,
}: {
  sales: readonly Sale[];
  range: DateRange;
  periodLabel: string;
}) {
  const [by, setBy] = useState<"medicines" | "companies">("medicines");
  const [sort, setSort] = useState<"profit" | "margin">("profit");
  const medicines = useMedicineStore((s) => s.medicines);
  const batches = useInventoryStore((s) => s.batches);
  const all = useMemo(
    () => profitBy(sales, batches, medicines, range),
    [sales, batches, medicines, range],
  );
  const rows = useMemo(() => {
    const list = [...all[by]];
    // Thin margin first — only rows that really sold
    if (sort === "margin")
      list.sort(
        (a, b) => a.marginPct - b.marginPct || b.salesPaise - a.salesPaise,
      );
    return list;
  }, [all, by, sort]);

  const exportCsv = () =>
    downloadText(
      `profit-by-${by}_${periodLabel}.csv`,
      toCsv(rows, [
        {
          header: by === "medicines" ? "Medicine" : "Company",
          value: (x: ProfitRow) => x.name,
        },
        {
          header: by === "medicines" ? "Company" : "Medicines",
          value: (x) => x.detail,
        },
        { header: "Sold (packs)", value: (x) => x.soldPacks },
        { header: "Sales (Rs)", value: (x) => formatPaise(x.salesPaise) },
        { header: "Cost (Rs)", value: (x) => formatPaise(x.costPaise) },
        { header: "Profit (Rs)", value: (x) => formatPaise(x.profitPaise) },
        { header: "Margin %", value: (x) => x.marginPct },
      ]),
    );

  return (
    <ReportTable
      title="Profit by medicine / company"
      subtitle={`${periodLabel} · ${tr("sales − cost of the batches sold, before returns")}`}
      rows={rows.slice(0, SHOWN)}
      getKey={(x) => x.key}
      empty="No bills in this period"
      action={
        <div className="flex flex-wrap items-center gap-1.5">
          <Segmented
            label="Profit by"
            value={by}
            onChange={setBy}
            options={[
              ["medicines", "Medicine"],
              ["companies", "Company"],
            ]}
          />
          <Segmented
            label="Sort"
            value={sort}
            onChange={setSort}
            options={[
              ["profit", "Most profit"],
              ["margin", "Lowest margin"],
            ]}
          />
          <button
            type="button"
            disabled={rows.length === 0}
            onClick={exportCsv}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-[11px] font-medium hover:bg-muted disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            {tr("Export")}
          </button>
        </div>
      }
      columns={[
        {
          key: "name",
          label: by === "medicines" ? "Medicine" : "Company",
          render: (x) => (
            <>
              {x.name}
              <span className="block text-[10px] text-muted-foreground">
                {x.detail}
              </span>
            </>
          ),
        },
        {
          key: "sold",
          label: "Sold",
          align: "right",
          width: "w-[80px]",
          render: (x) => x.soldPacks,
        },
        {
          key: "sales",
          label: "Sales (₹)",
          align: "right",
          width: "w-[100px]",
          render: (x) => formatPaise(x.salesPaise),
        },
        {
          key: "cost",
          label: "Cost (₹)",
          align: "right",
          width: "w-[100px]",
          render: (x) => formatPaise(x.costPaise),
        },
        {
          key: "profit",
          label: "Profit (₹)",
          align: "right",
          width: "w-[100px]",
          render: (x) => (
            <b
              className={cn(
                x.profitPaise < 0
                  ? "text-red-600"
                  : "text-emerald-700 dark:text-emerald-400",
              )}
            >
              {formatPaise(x.profitPaise)}
            </b>
          ),
        },
        {
          key: "margin",
          label: "Margin",
          align: "right",
          width: "w-[80px]",
          render: (x) => (
            <span
              className={cn(
                x.marginPct < 10 && "text-orange-600 font-semibold",
              )}
            >
              {x.marginPct}%
            </span>
          ),
        },
      ]}
    />
  );
}
