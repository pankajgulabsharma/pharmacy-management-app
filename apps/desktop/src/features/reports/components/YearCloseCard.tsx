import { useState } from "react";
import { toast } from "sonner";
import { CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/api";
import { downloadText } from "@/lib/csv";
import { tr } from "@/lib/i18n";
import type { StockBatch } from "@medicare/domain/inventory/types";
import type { Medicine } from "@medicare/domain/medicines/types";
import { batchCostPaise } from "@medicare/domain/inventory/stock";
import { financialYear } from "@medicare/domain/lib/docNo";
import { inrFromPaise } from "@medicare/domain/lib/money";
import { stockCsv } from "@medicare/domain/reports/exports";
import { ReportCard } from "./ReportTable";

/**
 * Year close (31 March): nothing to "run" — bill numbers start again by
 * themselves on 1 April and a year-end backup is kept for ever. What the
 * accountant needs is the CLOSING STOCK of the year that ended: worked out
 * from the stock register (today's stock minus everything moved since).
 */
export function YearCloseCard({
  medicines,
}: {
  medicines: readonly Medicine[];
}) {
  const fy = financialYear();
  const last = financialYear(new Date(fy.from.getTime() - 1));
  const end = new Date(fy.from.getTime() - 1);
  const endText = end.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const [value, setValue] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    try {
      const r = await apiGet<{ batches: StockBatch[] }>(
        `/api/stock/closing?at=${encodeURIComponent(fy.from.toISOString())}`,
      );
      const byId = new Map(medicines.map((m) => [m.id, m]));
      setValue(
        r.batches.reduce((s, b) => {
          const m = byId.get(b.medicineId);
          return m ? s + batchCostPaise(b, m) : s;
        }, 0),
      );
      downloadText(
        `closing-stock_FY${last.label}.csv`,
        stockCsv(r.batches, medicines),
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ReportCard
      title={tr("Year close")}
      subtitle={tr("Financial year {{fy}} ended on {{date}}", {
        fy: last.label,
        date: endText,
      })}
      action={
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => void download()}
          className="h-8 rounded-lg text-[11px] gap-1.5"
        >
          <CalendarCheck className="h-3.5 w-3.5" />
          {tr("Closing stock on {{date}}", { date: endText })}
        </Button>
      }
    >
      <ul className="text-[11px] text-muted-foreground space-y-1 list-disc pl-4">
        {value !== null ? (
          <li>
            {tr("Closing stock value (at cost)")}:{" "}
            <b className="text-foreground">{inrFromPaise(value)}</b>{" "}
            {tr("— this is next year's opening stock")}
          </li>
        ) : null}
        <li>
          {tr(
            "Bill numbers start again from 0001 every 1 April by themselves (INV/{{fy}}/0001).",
            { fy: fy.label },
          )}
        </li>
        <li>
          {tr(
            "A year-end backup is made on the first day of the new year and kept for ever (Settings → Backup).",
          )}
        </li>
        <li>
          {tr(
            "Udhaar balances and stock simply carry on — nothing to close or re-enter.",
          )}
        </li>
      </ul>
    </ReportCard>
  );
}
