import { useMemo } from "react";
import { AlertTriangle, Landmark, ReceiptText, Undo2 } from "lucide-react";
import type { Sale, SaleReturn } from "@medicare/domain/billing/types";
import { inrFromPaise } from "@medicare/domain/lib/money";
import type { DateRange } from "@medicare/domain/reports/period";
import {
  COMPOSITION_RATE_PCT,
  compositionQuarters,
  compositionSummary,
} from "@medicare/domain/reports/composition";
import { StatCard } from "@/components/common/StatCard";
import { tr, trn } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ReportCard } from "./ReportTable";

const day = (d: Date) =>
  d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

/**
 * GST tab for a composition shop: turnover and the 1% tax for the period,
 * and the four CMP-08 quarters of the year with their due dates.
 */
export function CompositionTab({
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
  const s = useMemo(
    () => compositionSummary(sales, saleReturns, range),
    [sales, saleReturns, range],
  );
  const quarters = useMemo(
    () => compositionQuarters(sales, saleReturns, range.to),
    [sales, saleReturns, range.to],
  );
  const now = new Date();

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <StatCard
          icon={ReceiptText}
          label="Turnover (bills of supply)"
          value={inrFromPaise(s.turnoverPaise)}
          hint={trn(s.bills, "1 bill", "{{n}} bills")}
          iconClass="bg-primary/10 text-primary"
        />
        <StatCard
          icon={Undo2}
          label="Less: returns"
          value={inrFromPaise(s.returnsPaise)}
          iconClass="bg-amber-500/10 text-amber-600"
        />
        <StatCard
          icon={Landmark}
          label={`Composition tax @ ${COMPOSITION_RATE_PCT}%`}
          value={inrFromPaise(s.taxPaise)}
          hint={tr("CGST {{c}} + SGST {{s}}", {
            c: inrFromPaise(s.cgstPaise),
            s: inrFromPaise(s.sgstPaise),
          })}
          iconClass="bg-red-500/10 text-red-500"
        />
      </div>

      {s.taxInvoices ? (
        <p className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-[11px]">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
          {trn(
            s.taxInvoices,
            "1 tax invoice in this period was made before the shop moved to composition — its GST is shown below for GSTR-1 / 3B.",
            "{{n}} tax invoices in this period were made before the shop moved to composition — their GST is shown below for GSTR-1 / 3B.",
          )}
        </p>
      ) : null}

      <ReportCard
        title="CMP-08 — quarter by quarter"
        subtitle={tr(
          "Pay by the 18th after each quarter · GSTR-4 once a year by 30 April · {{period}} shown above",
          { period: periodLabel },
        )}
        flush
      >
        <table className="w-full text-[11.5px]">
          <thead className="bg-muted/50 text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr className="border-b border-border">
              <th className="py-2 pl-3 text-left font-medium">
                {tr("Quarter")}
              </th>
              <th className="text-right font-medium">{tr("Bills")}</th>
              <th className="text-right font-medium">{tr("Turnover")}</th>
              <th className="text-right font-medium">{tr("CGST 0.5%")}</th>
              <th className="text-right font-medium">{tr("SGST 0.5%")}</th>
              <th className="text-right font-medium">{tr("Tax")}</th>
              <th className="pr-3 text-right font-medium">{tr("Due")}</th>
            </tr>
          </thead>
          <tbody>
            {quarters.map((q) => {
              const future = q.range.from > now;
              return (
                <tr
                  key={q.label}
                  className={cn(
                    "border-b border-border/60",
                    future && "text-muted-foreground",
                  )}
                >
                  <td className="py-2 pl-3 font-medium">{q.label}</td>
                  <td className="text-right tabular-nums">{q.summary.bills}</td>
                  <td className="text-right tabular-nums">
                    {inrFromPaise(q.summary.turnoverPaise)}
                  </td>
                  <td className="text-right tabular-nums">
                    {inrFromPaise(q.summary.cgstPaise)}
                  </td>
                  <td className="text-right tabular-nums">
                    {inrFromPaise(q.summary.sgstPaise)}
                  </td>
                  <td className="text-right font-semibold tabular-nums">
                    {inrFromPaise(q.summary.taxPaise)}
                  </td>
                  <td className="pr-3 text-right tabular-nums">{day(q.due)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="px-3 py-2 text-[10.5px] text-muted-foreground">
          {tr(
            "Composition shops don't charge GST on bills and can't claim input tax credit — GST paid on purchases is part of the cost.",
          )}
        </p>
      </ReportCard>
    </div>
  );
}
