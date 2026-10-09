import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { FileArchive, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/StatusBadge";
import { saveBlob, downloadText, toCsv } from "@/lib/csv";
import { tr } from "@/lib/i18n";
import type { Sale, SaleReturn } from "@medicare/domain/billing/types";
import type { Purchase } from "@medicare/domain/purchases/types";
import { toISODate } from "@medicare/domain/lib/date";
import { formatPaise } from "@medicare/domain/lib/money";
import { zipFiles } from "@medicare/domain/lib/zip";
import type { DateRange } from "@medicare/domain/reports/period";
import { gstr1, gstr1Files } from "@medicare/domain/reports/gstr1";
import {
  MATCH_LABELS,
  matchGstr2b,
  parseGstr2b,
  type MatchRow,
  type MatchStatus,
} from "@medicare/domain/reports/gstr2b";
import { ReportCard, ReportTable } from "./ReportTable";

const TONE: Record<MatchStatus, "success" | "warning" | "danger" | "info"> = {
  matched: "success",
  tax_differs: "danger",
  not_in_2b: "warning",
  not_in_books: "info",
};

/**
 * GST returns, free: GSTR-1 files for the GST Offline Tool (or the CA),
 * and the GSTR-2B check of purchase bills against what suppliers filed.
 */
export function GstReturns({
  sales,
  saleReturns,
  purchases,
  range,
  shopGstin,
}: {
  sales: readonly Sale[];
  saleReturns: readonly SaleReturn[];
  purchases: readonly Purchase[];
  range: DateRange;
  shopGstin: string;
}) {
  const r = useMemo(
    () => gstr1(sales, saleReturns, range, shopGstin),
    [sales, saleReturns, range, shopGstin],
  );
  const period = `${toISODate(range.from)}_to_${toISODate(range.to)}`;

  const download = () => {
    const zip = zipFiles(
      gstr1Files(r).map((f) => ({ name: f.name, data: f.csv })),
    );
    saveBlob(
      new Blob([zip as BlobPart], { type: "application/zip" }),
      `GSTR-1_${period}.zip`,
    );
    toast.success(tr("GSTR-1 files downloaded"), {
      description: tr(
        "GST Offline Tool → Import Files → CSV: import each file, then upload the JSON it makes. Or send the zip to your CA.",
      ),
    });
  };

  // GSTR-2B check
  const fileRef = useRef<HTMLInputElement>(null);
  const [match, setMatch] = useState<{
    period: string;
    rows: MatchRow[];
  } | null>(null);
  const open2b = async (file: File) => {
    try {
      const twoB = parseGstr2b(await file.text());
      setMatch({ period: twoB.period, rows: matchGstr2b(twoB, purchases) });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const counts = useMemo(() => {
    const c: Record<MatchStatus, number> = {
      matched: 0,
      tax_differs: 0,
      not_in_2b: 0,
      not_in_books: 0,
    };
    for (const x of match?.rows ?? []) c[x.status]++;
    return c;
  }, [match]);
  const problems = match?.rows.filter((x) => x.status !== "matched") ?? [];

  if (!shopGstin)
    return (
      <ReportCard title="GST returns (GSTR-1, GSTR-2B)">
        <p className="text-[11px] text-muted-foreground">
          {tr(
            "Add your shop's GSTIN in Settings → Shop to make GSTR-1 files and check GSTR-2B.",
          )}
        </p>
      </ReportCard>
    );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <ReportCard
        title="GSTR-1 (sales return)"
        subtitle="Files for the free GST Offline Tool, or for your CA"
        action={
          <Button
            type="button"
            onClick={download}
            className="h-8 rounded-lg text-[11px] gap-1.5"
          >
            <FileArchive className="h-3.5 w-3.5" />
            {tr("Download GSTR-1 files")}
          </Button>
        }
      >
        <ul className="text-[11px] space-y-1">
          <li>
            {tr("B2B bills (with GSTIN)")}:{" "}
            <b>{new Set(r.b2b.map((x) => x.invoiceNo)).size}</b>
          </li>
          <li>
            {tr("Retail (B2C) taxable value")}:{" "}
            <b>₹{formatPaise(r.b2cs.reduce((s, x) => s + x.taxable, 0))}</b>
          </li>
          <li>
            {tr("Credit notes (B2B returns)")}:{" "}
            <b>{new Set(r.cdnr.map((x) => x.noteNo)).size}</b>
          </li>
          <li>
            {tr("HSN rows")}: <b>{r.hsnB2b.length + r.hsnB2c.length}</b>
            {r.docs[0]
              ? ` · ${tr("bills")} ${r.docs[0].from} → ${r.docs[0].to}`
              : ""}
          </li>
        </ul>
        <p className="text-[10px] text-muted-foreground mt-2">
          {tr(
            "Choose the return's month above (e.g. Last month). The zip has b2b, b2cs, cdnr, hsn(b2b), hsn(b2c) and docs — the same sheets Tally / Busy export.",
          )}
        </p>
      </ReportCard>

      <ReportCard
        title="GSTR-2B match (purchase bills)"
        subtitle="Did your suppliers report the bills you entered?"
        action={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => fileRef.current?.click()}
              className="h-8 rounded-lg text-[11px] gap-1.5"
            >
              <FileUp className="h-3.5 w-3.5" />
              {tr("Open GSTR-2B JSON")}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              hidden
              aria-label={tr("GSTR-2B file")}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void open2b(f);
              }}
            />
          </>
        }
      >
        {match ? (
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(counts) as MatchStatus[]).map((k) => (
              <StatusBadge key={k} tone={TONE[k]} shape="rounded">
                {tr(MATCH_LABELS[k])}: {counts[k]}
              </StatusBadge>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            {tr(
              "GST portal → Returns → GSTR-2B → Download → JSON (free). Open that file here: every supplier bill is checked against your purchases.",
            )}
          </p>
        )}
      </ReportCard>

      {match && problems.length ? (
        <div className="lg:col-span-2">
          <ReportTable
            title="Bills to check"
            subtitle={`GSTR-2B ${match.period.slice(0, 2)}/${match.period.slice(2)}`}
            rows={problems}
            getKey={(x) => `${x.status}|${x.gstin}|${x.invoiceNo}`}
            empty="Everything matches"
            action={
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  downloadText(
                    `gstr2b-check_${match.period}.csv`,
                    toCsv(match.rows, [
                      {
                        header: "Status",
                        value: (x) => MATCH_LABELS[x.status],
                      },
                      { header: "Supplier", value: (x) => x.supplier },
                      { header: "GSTIN", value: (x) => x.gstin },
                      { header: "Invoice", value: (x) => x.invoiceNo },
                      { header: "Date", value: (x) => x.date },
                      {
                        header: "GST as per 2B (Rs)",
                        value: (x) => (x.gst2b === null ? "" : x.gst2b / 100),
                      },
                      {
                        header: "GST in MediCare (Rs)",
                        value: (x) =>
                          x.gstBooks === null ? "" : x.gstBooks / 100,
                      },
                    ]),
                  )
                }
                className="h-7 rounded-md text-[11px]"
              >
                {tr("Export")}
              </Button>
            }
            columns={[
              {
                key: "st",
                label: "Status",
                render: (x) => (
                  <StatusBadge tone={TONE[x.status]} shape="rounded">
                    {tr(MATCH_LABELS[x.status])}
                  </StatusBadge>
                ),
              },
              { key: "sup", label: "Supplier", render: (x) => x.supplier },
              { key: "inv", label: "Invoice", render: (x) => x.invoiceNo },
              { key: "dt", label: "Date", render: (x) => x.date },
              {
                key: "g2",
                label: "GST (2B)",
                align: "right",
                render: (x) => (x.gst2b === null ? "—" : formatPaise(x.gst2b)),
              },
              {
                key: "gb",
                label: "GST (books)",
                align: "right",
                render: (x) =>
                  x.gstBooks === null ? "—" : formatPaise(x.gstBooks),
              },
            ]}
          />
        </div>
      ) : null}
    </div>
  );
}
