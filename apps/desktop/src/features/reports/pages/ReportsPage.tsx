import {
  registerCsv,
  scheduleRegister,
} from "@medicare/domain/medicines/schedule";
import { GstReturns } from "../components/GstReturns";
import { YearCloseCard } from "../components/YearCloseCard";
import { useMemo, useState } from "react";
import {
  BarChart3,
  Download,
  ClipboardList,
  IndianRupee,
  Landmark,
  Package,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { Kbd } from "@/components/common/Kbd";
import { useHotkeys } from "@/hooks/useHotkeys";
import { oneOf, useUrlIntent } from "@/hooks/useUrlIntent";
import { KEYS } from "@/app/shortcuts/registry";
import {
  SegmentedTabs,
  type SegmentedTab,
} from "@/components/common/SegmentedTabs";
import { useSalesInRange } from "@/features/billing/hooks/useSalesHistory";
import { usePurchaseStore } from "@/features/purchases/store/usePurchaseStore";
import { useInventoryStore } from "@/features/inventory/store/useInventoryStore";
import { useMedicineStore } from "@/features/medicines/store/useMedicineStore";
import { useSettingsStore } from "@/features/settings/store/useSettingsStore";
import { downloadText } from "@/lib/csv";
import {
  gstCsv,
  purchasesCsv,
  salesCsv,
  stockCsv,
} from "@medicare/domain/reports/exports";
import { toISODate } from "@medicare/domain/lib/date";
import { PeriodFilter } from "../components/PeriodFilter";
import {
  GstTab,
  PurchasesTab,
  SalesTab,
  RegisterTab,
  StockTab,
} from "../components/ReportTabs";
import {
  customRange,
  describeRange,
  presetRange,
  type PeriodPreset,
} from "@medicare/domain/reports/period";
import {
  gstReport,
  purchaseReport,
  salesReport,
  stockReport,
} from "@medicare/domain/reports/reports";

type Tab = "sales" | "purchases" | "gst" | "stock" | "register";

const TABS: SegmentedTab<Tab>[] = [
  { id: "sales", label: "Sales", icon: IndianRupee },
  { id: "purchases", label: "Purchases", icon: Truck },
  { id: "gst", label: "GST", icon: Landmark },
  { id: "stock", label: "Stock", icon: Package },
  { id: "register", label: "H1 register", icon: ClipboardList },
];

export default function ReportsPage() {
  const purchases = usePurchaseStore((s) => s.purchases);
  const debitNotes = usePurchaseStore((s) => s.returns);
  const batches = useInventoryStore((s) => s.batches);
  const medicines = useMedicineStore((s) => s.medicines);
  const expiringDays = useSettingsStore((s) => s.inventory.expiringSoonDays);
  const shopGstin = useSettingsStore((s) => s.shop.gstin);

  // Dashboard links like /reports?tab=sales&period=today
  const intent = useUrlIntent();
  const [tab, setTab] = useState<Tab>(
    oneOf(
      intent.tab,
      ["sales", "purchases", "gst", "stock", "register"] as const,
      "sales",
    ),
  );
  // 7 days: enough to see a trend without a mostly-empty chart
  const [preset, setPreset] = useState<PeriodPreset>(
    oneOf(
      intent.period,
      [
        "today",
        "yesterday",
        "7d",
        "30d",
        "90d",
        "month",
        "lastMonth",
        "fy",
        "lastFy",
      ] as const,
      "7d",
    ),
  );
  const [today] = useState(() => toISODate(new Date()));
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);

  // An invalid custom range falls back to today (and the inputs are flagged)
  const range = useMemo(
    () =>
      preset === "custom"
        ? (customRange(from, to) ?? presetRange("today"))
        : presetRange(preset),
    [preset, from, to],
  );
  const customInvalid = preset === "custom" && customRange(from, to) === null;
  // Older periods are fetched from the server (counters keep ~90 days)
  const history = useSalesInRange(range);
  const { sales, saleReturns } = history;
  const periodLabel = describeRange(range);

  // Only the open tab is worked out (years of bills → no wasted work)
  const sr = useMemo(
    () =>
      tab === "sales" ? salesReport(sales, saleReturns, batches, range) : null,
    [tab, sales, saleReturns, batches, range],
  );
  const pr = useMemo(
    () =>
      tab === "purchases" ? purchaseReport(purchases, debitNotes, range) : null,
    [tab, purchases, debitNotes, range],
  );
  const gr = useMemo(
    () =>
      tab === "gst"
        ? gstReport(sales, saleReturns, purchases, debitNotes, range)
        : null,
    [tab, sales, saleReturns, purchases, debitNotes, range],
  );
  const st = useMemo(
    () =>
      tab === "stock" ? stockReport(batches, medicines, expiringDays) : null,
    [tab, batches, medicines, expiringDays],
  );
  const reg = useMemo(
    () => (tab === "register" ? scheduleRegister(sales, range) : null),
    [tab, sales, range],
  );

  const exportCsv = () => {
    const stamp =
      tab === "stock"
        ? today
        : `${toISODate(range.from)}_to_${toISODate(range.to)}`;
    const csv =
      tab === "sales"
        ? salesCsv(sales, range)
        : pr
          ? purchasesCsv(pr)
          : gr
            ? gstCsv(gr)
            : reg
              ? registerCsv(reg)
              : stockCsv(batches, medicines);
    downloadText(`${tab}-report_${stamp}.csv`, csv);
    toast.success("Report exported", {
      description: "Opens in Excel / Google Sheets",
    });
  };

  // Keyboard: [ ] previous / next report · Alt+E export
  const step = (d: number) => {
    const i = TABS.findIndex((t) => t.id === tab);
    setTab(TABS[(i + d + TABS.length) % TABS.length].id);
  };
  useHotkeys([
    { keys: KEYS.prevTab, handler: () => step(-1) },
    { keys: KEYS.nextTab, handler: () => step(1) },
    { keys: KEYS.exportReport, handler: () => exportCsv() },
  ]);

  return (
    <div className="h-full w-full p-3 overflow-hidden box-border bg-background flex flex-col gap-2.5 min-h-0">
      <PageHeader
        icon={BarChart3}
        title="Reports"
        subtitle={
          tab === "stock"
            ? "Stock as of now"
            : customInvalid
              ? "Choose a valid range — “From” must be on or before “To”"
              : periodLabel
        }
        actions={
          <>
            {/* Which report is open: the selected tab is solid blue */}
            <SegmentedTabs
              tabs={TABS}
              value={tab}
              onChange={setTab}
              ariaLabel="Report"
            />
            <Button
              type="button"
              variant="outline"
              onClick={exportCsv}
              className="h-9 rounded-lg text-[12px] gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
              <Kbd keys={KEYS.exportReport} className="ml-1" />
            </Button>
          </>
        }
      />

      {/* Period — chips and custom dates always on one line */}
      <div className="shrink-0 min-h-9 flex items-center gap-3">
        {tab !== "stock" && (history.loading || history.error) ? (
          <span
            className={
              history.error
                ? "order-last text-[11px] text-red-600"
                : "order-last text-[11px] text-muted-foreground"
            }
          >
            {history.error ?? "Loading older bills…"}
          </span>
        ) : null}
        {tab !== "stock" ? (
          <PeriodFilter
            preset={preset}
            onPresetChange={setPreset}
            from={from}
            to={to}
            onFromChange={setFrom}
            onToChange={setTo}
            invalid={customInvalid}
          />
        ) : (
          <p className="text-[11px] text-muted-foreground">
            The stock report always shows today's position — no period to
            choose.
          </p>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-0.5">
        {sr ? <SalesTab r={sr} periodLabel={periodLabel} /> : null}
        {pr ? <PurchasesTab r={pr} periodLabel={periodLabel} /> : null}
        {gr ? (
          <div className="space-y-3">
            <GstTab r={gr} periodLabel={periodLabel} />
            <GstReturns
              sales={sales}
              saleReturns={saleReturns}
              purchases={purchases}
              range={range}
              shopGstin={shopGstin}
            />
          </div>
        ) : null}
        {st ? (
          <div className="space-y-3">
            <StockTab r={st} expiringDays={expiringDays} />
            <YearCloseCard medicines={medicines} />
          </div>
        ) : null}
        {reg ? <RegisterTab rows={reg} periodLabel={periodLabel} /> : null}
      </div>
    </div>
  );
}
