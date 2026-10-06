import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  CalendarX,
  IndianRupee,
  Landmark,
  Package,
  Percent,
  Receipt,
  ReceiptText,
  Truck,
  Undo2,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/common/StatCard";
import { CodeChip } from "@/components/common/CodeChip";
import { PAYMENT_METHOD_LABELS } from "@/features/billing/types";
import { splitCgstSgst } from "@/lib/gst";
import { formatPaise, inrFromPaise } from "@/lib/money";
import {
  salesInsights,
  type GstReport,
  type PurchaseReport,
  type SalesReport,
  type StockReport,
} from "../utils/reports";
import { plural } from "@/lib/format";
import { ReportCard, ReportTable, ShareBar } from "./ReportTable";
import { DailyChart } from "./DailyChart";
import { SalesInsightsCard } from "./SalesInsightsCard";

const CARDS = "grid grid-cols-2 xl:grid-cols-4 gap-2";
const CHART_ROW =
  "grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] gap-3";
const pct = (part: number, whole: number) =>
  whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : "0%";

/* ------------------------------------------------------------------ */
/* Sales                                                              */
/* ------------------------------------------------------------------ */

export function SalesTab({
  r,
  periodLabel,
}: {
  r: SalesReport;
  periodLabel: string;
}) {
  const payTotal = r.byPayment.reduce((s, p) => s + p.amountPaise, 0);
  const payMax = Math.max(0, ...r.byPayment.map((p) => p.amountPaise));
  const topMax = Math.max(0, ...r.topMedicines.map((m) => m.amountPaise));
  const topTotal = r.topMedicines.reduce((s, m) => s + m.amountPaise, 0);
  const insights = salesInsights(r.daily);

  return (
    <div className="space-y-3">
      <div className={CARDS}>
        <StatCard
          icon={IndianRupee}
          label="Net sales (after returns)"
          value={inrFromPaise(r.netAfterReturnsPaise)}
          iconClass="bg-primary/10 text-primary"
          hint={`Billed ${inrFromPaise(r.netPaise)}`}
        />
        <StatCard
          icon={Receipt}
          label="Bills"
          value={String(r.billCount)}
          iconClass="bg-violet-500/10 text-violet-600"
          hint={`Average bill ${inrFromPaise(r.avgBillPaise)}`}
        />
        <StatCard
          icon={Undo2}
          label="Customer returns"
          value={inrFromPaise(r.returnsPaise)}
          iconClass="bg-orange-500/10 text-orange-600"
          hint={`Discounts given ${inrFromPaise(r.discountPaise)}`}
        />
        <StatCard
          icon={Percent}
          label="Estimated margin"
          value={inrFromPaise(r.marginPaise)}
          iconClass="bg-emerald-500/10 text-emerald-600"
          hint={`${pct(r.marginPaise, r.netPaise)} of sales · cost ${inrFromPaise(r.costPaise)}`}
        />
      </div>

      {/* Chart + the reasons behind its shape */}
      <div className={CHART_ROW}>
        <ReportCard title="Sales by day" subtitle={periodLabel}>
          <DailyChart data={r.daily} countLabel="bill" shadeSundays />
        </ReportCard>
        <SalesInsightsCard i={insights} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(280px,1fr)_minmax(0,2fr)] gap-3">
        <ReportCard
          title="Payment modes"
          subtitle={`${plural(r.billCount, "bill")} · ${inrFromPaise(payTotal)}`}
        >
          {r.byPayment.length === 0 ? (
            <p className="py-10 text-center text-[11px] text-muted-foreground">
              No bills in this period
            </p>
          ) : (
            <ul className="space-y-3">
              {r.byPayment.map((p) => (
                <li key={p.method} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2 text-[11px]">
                    <span className="font-medium text-foreground">
                      {PAYMENT_METHOD_LABELS[p.method]}
                      <span className="ml-1.5 font-normal text-muted-foreground">
                        {plural(p.bills, "bill")}
                      </span>
                    </span>
                    <span className="tabular-nums">
                      <span className="font-semibold">
                        {inrFromPaise(p.amountPaise)}
                      </span>
                      <span className="ml-1.5 text-muted-foreground">
                        {pct(p.amountPaise, payTotal)}
                      </span>
                    </span>
                  </div>
                  <ShareBar
                    value={p.amountPaise}
                    max={payMax}
                    tone={p.method === "udhaar" ? "red" : "primary"}
                  />
                </li>
              ))}
            </ul>
          )}
        </ReportCard>

        <ReportTable
          title="Top selling medicines"
          subtitle="By amount · top 10"
          rows={r.topMedicines}
          getKey={(m) => m.medicineId}
          empty="No sales in this period"
          maxHeightClass="max-h-[300px]"
          footer={["", "Top 10 total", "", "", formatPaise(topTotal)]}
          columns={[
            {
              key: "rank",
              label: "#",
              width: "w-[40px]",
              render: (m) => (
                <span className="text-muted-foreground">
                  {r.topMedicines.indexOf(m) + 1}
                </span>
              ),
            },
            {
              key: "name",
              label: "Medicine",
              render: (m) => <span className="font-medium">{m.name}</span>,
            },
            {
              key: "qty",
              label: "Quantity",
              width: "w-[130px]",
              render: (m) =>
                [
                  m.qtyStrip ? `${m.qtyStrip} ${m.unit}` : "",
                  m.qtyLoose ? `${m.qtyLoose} LSE` : "",
                ]
                  .filter(Boolean)
                  .join(" + "),
            },
            {
              key: "share",
              label: "Share",
              width: "w-[150px]",
              render: (m) => (
                <div className="flex items-center gap-2">
                  <ShareBar value={m.amountPaise} max={topMax} />
                  <span className="w-10 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
                    {pct(m.amountPaise, r.netPaise)}
                  </span>
                </div>
              ),
            },
            {
              key: "amount",
              label: "Amount (₹)",
              align: "right",
              width: "w-[110px]",
              render: (m) => formatPaise(m.amountPaise),
            },
          ]}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Purchases                                                          */
/* ------------------------------------------------------------------ */

export function PurchasesTab({
  r,
  periodLabel,
}: {
  r: PurchaseReport;
  periodLabel: string;
}) {
  const max = Math.max(0, ...r.bySupplier.map((s) => s.amountPaise));
  const paidShare = r.netPaise ? (r.paidPaise / r.netPaise) * 100 : 0;
  const dueShare = r.netPaise ? (r.outstandingPaise / r.netPaise) * 100 : 0;

  return (
    <div className="space-y-3">
      <div className={CARDS}>
        <StatCard
          icon={Truck}
          label="Purchased"
          value={inrFromPaise(r.netPaise)}
          iconClass="bg-primary/10 text-primary"
          hint={plural(r.invoiceCount, "invoice")}
        />
        <StatCard
          icon={Landmark}
          label="Input GST (tax credit)"
          value={inrFromPaise(r.gstPaise)}
          iconClass="bg-violet-500/10 text-violet-600"
          hint="Adjusts against GST on sales"
        />
        <StatCard
          icon={Wallet}
          label="Still to pay"
          value={inrFromPaise(r.outstandingPaise)}
          iconClass="bg-orange-500/10 text-orange-600"
          hint={`Paid ${inrFromPaise(r.paidPaise)}`}
        />
        <StatCard
          icon={Undo2}
          label="Returned to suppliers"
          value={inrFromPaise(r.debitNotesPaise)}
          iconClass="bg-emerald-500/10 text-emerald-600"
          hint="Debit notes in this period"
        />
      </div>

      <div className={CHART_ROW}>
        <ReportCard title="Purchases by day" subtitle={periodLabel}>
          <DailyChart data={r.daily} countLabel="invoice" />
        </ReportCard>

        <ReportCard
          title="Payment status"
          subtitle={`Of ${inrFromPaise(r.netPaise)} purchased`}
        >
          {r.netPaise === 0 ? (
            <p className="py-10 text-center text-[11px] text-muted-foreground">
              No purchases in this period
            </p>
          ) : (
            <div className="space-y-4">
              <div
                className="flex h-3 w-full overflow-hidden rounded-full bg-muted"
                aria-hidden="true"
              >
                <div
                  className="bg-emerald-500"
                  style={{ width: `${paidShare}%` }}
                />
                <div
                  className="bg-orange-500"
                  style={{ width: `${dueShare}%` }}
                />
              </div>
              <Legend
                color="bg-emerald-500"
                label="Paid"
                value={inrFromPaise(r.paidPaise)}
                share={pct(r.paidPaise, r.netPaise)}
              />
              <Legend
                color="bg-orange-500"
                label="Still to pay"
                value={inrFromPaise(r.outstandingPaise)}
                share={pct(r.outstandingPaise, r.netPaise)}
              />
              <Legend
                color="bg-violet-500"
                label="Input GST in these bills"
                value={inrFromPaise(r.gstPaise)}
                share={pct(r.gstPaise, r.netPaise)}
              />
            </div>
          )}
        </ReportCard>
      </div>

      <ReportTable
        title="Purchases by supplier"
        subtitle="Biggest first"
        rows={r.bySupplier}
        getKey={(s) => s.supplierId}
        empty="No purchases in this period"
        footer={[
          "Total",
          r.invoiceCount,
          "",
          formatPaise(r.netPaise),
          formatPaise(r.outstandingPaise),
        ]}
        columns={[
          {
            key: "name",
            label: "Supplier",
            render: (s) => <span className="font-medium">{s.name}</span>,
          },
          {
            key: "inv",
            label: "Invoices",
            width: "w-[90px]",
            render: (s) => s.invoices,
          },
          {
            key: "share",
            label: "Share",
            width: "w-[180px]",
            render: (s) => (
              <div className="flex items-center gap-2">
                <ShareBar value={s.amountPaise} max={max} />
                <span className="w-11 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
                  {pct(s.amountPaise, r.netPaise)}
                </span>
              </div>
            ),
          },
          {
            key: "amt",
            label: "Amount (₹)",
            align: "right",
            width: "w-[130px]",
            render: (s) => formatPaise(s.amountPaise),
          },
          {
            key: "due",
            label: "Outstanding (₹)",
            align: "right",
            width: "w-[140px]",
            render: (s) => (
              <span
                className={
                  s.outstandingPaise
                    ? "font-medium text-orange-600 dark:text-orange-400"
                    : "text-muted-foreground"
                }
              >
                {formatPaise(s.outstandingPaise)}
              </span>
            ),
          },
        ]}
      />
    </div>
  );
}

function Legend({
  color,
  label,
  value,
  share,
}: {
  color: string;
  label: string;
  value: string;
  share: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <span className="inline-flex items-center gap-2">
        <span className={cn("h-2.5 w-2.5 rounded-sm", color)} />
        {label}
      </span>
      <span className="tabular-nums">
        <span className="font-semibold">{value}</span>
        <span className="ml-1.5 text-muted-foreground">{share}</span>
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* GST                                                                */
/* ------------------------------------------------------------------ */

/** Net per slab: "payable" in red, "credit" in green with a CR tag */
function Net({ paise }: { paise: number }) {
  if (paise === 0) return <span className="text-muted-foreground">0.00</span>;
  return paise > 0 ? (
    <span className="font-medium text-red-600 dark:text-red-400">
      {formatPaise(paise)}
    </span>
  ) : (
    <span className="font-medium text-emerald-600 dark:text-emerald-400">
      {formatPaise(-paise)} <span className="text-[9px]">CR</span>
    </span>
  );
}

export function GstTab({
  r,
  periodLabel,
}: {
  r: GstReport;
  periodLabel: string;
}) {
  const credit = r.netPayablePaise < 0;
  const max = Math.max(r.outGstPaise, r.inGstPaise, 1);
  const rows = r.rows.map((x) => ({
    ...x,
    out: splitCgstSgst(x.outGstPaise),
    in: splitCgstSgst(x.inGstPaise),
  }));
  const sum = (f: (x: (typeof rows)[number]) => number) =>
    formatPaise(rows.reduce((s, x) => s + f(x), 0));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <StatCard
          icon={ReceiptText}
          label="Output GST (on sales)"
          value={inrFromPaise(r.outGstPaise)}
          iconClass="bg-primary/10 text-primary"
          hint="Collected from customers"
        />
        <StatCard
          icon={Banknote}
          label="Input GST (on purchases)"
          value={inrFromPaise(r.inGstPaise)}
          iconClass="bg-violet-500/10 text-violet-600"
          hint="Paid to suppliers — your tax credit"
        />
        <StatCard
          icon={Landmark}
          label={credit ? "Credit carried forward" : "Net GST payable"}
          value={inrFromPaise(Math.abs(r.netPayablePaise))}
          iconClass={
            credit
              ? "bg-emerald-500/10 text-emerald-600"
              : "bg-red-500/10 text-red-500"
          }
          hint={
            credit
              ? "Input is more than output — nothing to pay"
              : "Output − input, to be paid"
          }
        />
      </div>

      <ReportCard title="Output vs input" subtitle={periodLabel}>
        <div className="space-y-3">
          <Compare
            label="Output GST (sales)"
            value={r.outGstPaise}
            max={max}
            tone="primary"
          />
          <Compare
            label="Input GST (purchases)"
            value={r.inGstPaise}
            max={max}
            tone="violet"
          />
          <p className="text-[11px] text-muted-foreground">
            {credit ? (
              <>
                You paid{" "}
                <b className="text-foreground">
                  {inrFromPaise(r.inGstPaise - r.outGstPaise)}
                </b>{" "}
                more GST on purchases than you collected on sales. Nothing is
                payable; the difference is carried forward as credit.
              </>
            ) : (
              <>
                You collected{" "}
                <b className="text-foreground">
                  {inrFromPaise(r.netPayablePaise)}
                </b>{" "}
                more GST than you paid on purchases — this is payable to the
                government.
              </>
            )}
          </p>
        </div>
      </ReportCard>

      <ReportTable
        title="GST by slab"
        subtitle="Sales minus customer returns · purchases minus debit notes · intra-state (CGST + SGST)"
        rows={rows}
        getKey={(x) => String(x.rate)}
        empty="No GST activity"
        footer={[
          "Total",
          sum((x) => x.outTaxablePaise),
          sum((x) => x.out.cgstPaise),
          sum((x) => x.out.sgstPaise),
          sum((x) => x.inTaxablePaise),
          sum((x) => x.in.cgstPaise),
          sum((x) => x.in.sgstPaise),
          <Net key="net" paise={r.netPayablePaise} />,
        ]}
        columns={[
          {
            key: "rate",
            label: "Slab",
            width: "w-[64px]",
            render: (x) => <span className="font-medium">{x.rate}%</span>,
          },
          {
            key: "ot",
            label: "Sales taxable",
            align: "right",
            render: (x) => formatPaise(x.outTaxablePaise),
          },
          {
            key: "oc",
            label: "Output CGST",
            align: "right",
            render: (x) => formatPaise(x.out.cgstPaise),
          },
          {
            key: "os",
            label: "Output SGST",
            align: "right",
            render: (x) => formatPaise(x.out.sgstPaise),
          },
          {
            key: "it",
            label: "Purchase taxable",
            align: "right",
            render: (x) => formatPaise(x.inTaxablePaise),
          },
          {
            key: "ic",
            label: "Input CGST",
            align: "right",
            render: (x) => formatPaise(x.in.cgstPaise),
          },
          {
            key: "is",
            label: "Input SGST",
            align: "right",
            render: (x) => formatPaise(x.in.sgstPaise),
          },
          {
            key: "net",
            label: "Net (₹)",
            align: "right",
            render: (x) => <Net paise={x.outGstPaise - x.inGstPaise} />,
          },
        ]}
      />
      <p className="text-[10px] text-muted-foreground">
        All amounts in ₹. A planning summary, not a filing — confirm with your
        CA before filing GSTR-3B.
      </p>
    </div>
  );
}

function Compare({
  label,
  value,
  max,
  tone,
}: {
  label: string;
  value: number;
  max: number;
  tone: "primary" | "violet";
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px]">
        <span>{label}</span>
        <span className="font-semibold tabular-nums">
          {inrFromPaise(value)}
        </span>
      </div>
      <div
        className="h-2.5 w-full rounded-full bg-muted overflow-hidden"
        aria-hidden="true"
      >
        <div
          className={cn(
            "h-full rounded-full",
            tone === "primary" ? "bg-primary" : "bg-violet-500",
          )}
          style={{ width: `${Math.max(1, (value / max) * 100)}%` }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stock                                                              */
/* ------------------------------------------------------------------ */

type Row = StockReport["expired"][number];

const BATCH_COLS = [
  {
    key: "name",
    label: "Medicine",
    render: (x: Row) => <span className="font-medium">{x.medicineName}</span>,
  },
  {
    key: "batch",
    label: "Batch / Expiry",
    width: "w-[120px]",
    render: (x: Row) => (
      <div className="leading-tight">
        <CodeChip>{x.batchNo}</CodeChip>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          Exp {x.expiry}
        </p>
      </div>
    ),
  },
  {
    key: "qty",
    label: "Qty",
    width: "w-[120px]",
    render: (x: Row) => x.qtyText,
  },
  {
    key: "val",
    label: "At cost (₹)",
    align: "right" as const,
    width: "w-[110px]",
    render: (x: Row) => formatPaise(x.costPaise),
  },
];

export function StockTab({
  r,
  expiringDays,
}: {
  r: StockReport;
  expiringDays: number;
}) {
  const catMax = Math.max(0, ...r.byCategory.map((c) => c.costPaise));
  return (
    <div className="space-y-3">
      <div className={CARDS}>
        <StatCard
          icon={Package}
          label="Stock value (at cost)"
          value={inrFromPaise(r.costValuePaise)}
          iconClass="bg-primary/10 text-primary"
          hint={`${plural(r.batchCount, "batch", "batches")} in stock`}
        />
        <StatCard
          icon={IndianRupee}
          label="Stock value (at MRP)"
          value={inrFromPaise(r.mrpValuePaise)}
          iconClass="bg-emerald-500/10 text-emerald-600"
          hint={`Potential margin ${inrFromPaise(r.mrpValuePaise - r.costValuePaise)}`}
        />
        <StatCard
          icon={CalendarClock}
          label={`Expiring in ${expiringDays} days`}
          value={inrFromPaise(r.expiringValuePaise)}
          iconClass="bg-amber-500/10 text-amber-600"
          hint={plural(r.expiring.length, "batch", "batches")}
        />
        <StatCard
          icon={CalendarX}
          label="Expired (not sellable)"
          value={inrFromPaise(r.expiredValuePaise)}
          iconClass="bg-red-500/10 text-red-500"
          hint={plural(r.expired.length, "batch", "batches")}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <ReportTable
          title={`Expiring within ${expiringDays} days`}
          subtitle="Sell first, or return to the supplier in time"
          rows={r.expiring}
          getKey={(x) => x.batchId}
          empty="Nothing expiring soon"
          columns={BATCH_COLS}
        />
        <ReportTable
          title="Expired stock"
          subtitle="Return to supplier or dispose as per rules"
          rows={r.expired}
          getKey={(x) => x.batchId}
          empty="No expired stock"
          columns={BATCH_COLS}
        />
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-3">
        <ReportTable
          title="Stock value by category"
          subtitle="At cost and at MRP"
          rows={r.byCategory}
          getKey={(c) => c.category}
          empty="No stock"
          footer={[
            "Total",
            r.batchCount,
            "",
            formatPaise(r.costValuePaise),
            formatPaise(r.mrpValuePaise),
          ]}
          columns={[
            {
              key: "cat",
              label: "Category",
              render: (c) => (
                <span className="font-medium whitespace-nowrap">
                  {c.category}
                </span>
              ),
            },
            {
              key: "b",
              label: "Batches",
              width: "w-[72px]",
              render: (c) => c.batches,
            },
            {
              key: "share",
              label: "Share",
              width: "w-[110px]",
              render: (c) => <ShareBar value={c.costPaise} max={catMax} />,
            },
            {
              key: "cost",
              label: "At cost (₹)",
              align: "right",
              width: "w-[110px]",
              render: (c) => formatPaise(c.costPaise),
            },
            {
              key: "mrp",
              label: "At MRP (₹)",
              align: "right",
              width: "w-[110px]",
              render: (c) => formatPaise(c.mrpPaise),
            },
          ]}
        />
        <ReportTable
          title="Below minimum stock"
          subtitle="Reorder these"
          rows={r.lowStock}
          getKey={(m) => m.medicineId}
          empty="Everything is above minimum"
          columns={[
            {
              key: "name",
              label: "Medicine",
              render: (m) => (
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <AlertTriangle className="h-3 w-3 text-orange-500" />
                  {m.name}
                </span>
              ),
            },
            {
              key: "s",
              label: "In stock",
              width: "w-[100px]",
              render: (m) => (
                <span className="font-medium text-red-600 dark:text-red-400">
                  {m.stockText}
                </span>
              ),
            },
            {
              key: "min",
              label: "Minimum",
              align: "right",
              width: "w-[90px]",
              render: (m) => m.minStock,
            },
          ]}
        />
      </div>
      <p className="text-[10px] text-muted-foreground">
        Stock is always “as of now” — the period filter doesn't apply here.
      </p>
    </div>
  );
}
