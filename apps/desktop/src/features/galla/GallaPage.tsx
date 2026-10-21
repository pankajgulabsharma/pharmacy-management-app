import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  Lock,
  Printer,
  RefreshCw,
  Sunrise,
  Banknote,
  Wallet,
} from "lucide-react";
import { businessDate } from "@medicare/domain/cash/galla";
import { dayReportHtml } from "@medicare/domain/cash/dayReport";
import {
  inrFromPaise,
  paiseToInput,
  parseRupees,
} from "@medicare/domain/lib/money";
import { PageHeader } from "@/components/common/PageHeader";
import { DateInput } from "@/components/common/DateInput";
import { fieldClass } from "@/components/common/formStyles";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { useCan } from "@/features/auth/store/useAuthStore";
import { useSettingsStore } from "@/features/settings/store/useSettingsStore";
import { useSalesStore } from "@/features/billing/store/useSalesStore";
import { useCustomerStore } from "@/features/customers/store/useCustomerStore";
import { usePrintPrefs } from "@/features/printing/usePrintPrefs";
import { printHtml } from "@/lib/print";
import { tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useGallaStore, type GallaView } from "./useGallaStore";
import { DiffBadge, Line, MoneyInput, Panel } from "./parts";
import { time } from "./format";
import { EntriesPanel } from "./EntriesPanel";
import { CountPanel } from "./CountPanel";

const errMsg = (e: unknown) =>
  e instanceof Error ? e.message : tr("Could not save");

/**
 * Galla / Day close: start the day with the opening cash, see what should
 * be in the drawer as the day goes, note cash in / out, then count the
 * notes at night and close. The owner sees every counter and every day.
 */
export default function GallaPage() {
  const view = useGallaStore((s) => s.view);
  const load = useGallaStore((s) => s.load);
  const date = useGallaStore((s) => s.date);
  const loading = useGallaStore((s) => s.loading);
  const owner = useCan("admin");
  const today = businessDate();
  const shown = date || today;

  // Any bill, return or udhaar payment changes today's numbers
  const salesTick = useSalesStore((s) => s.sales.length + s.saleReturns.length);
  const payTick = useCustomerStore((s) => s.payments.length);
  // Opened from an alert: /galla?date=…&counter=…
  const [params] = useSearchParams();
  const wantDate = params.get("date") ?? "";
  const wantCounter = params.get("counter") ?? "";
  useEffect(() => {
    void load({
      date: wantDate && wantDate !== today ? wantDate : "",
      counter: wantCounter,
    }).catch((e) => toast.error(errMsg(e)));
  }, [load, wantDate, wantCounter, today]);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    void load().catch((e) => toast.error(errMsg(e)));
  }, [load, salesTick, payTick]);

  return (
    <div className="h-full w-full overflow-y-auto bg-background p-3">
      <div className="mx-auto flex max-w-6xl flex-col gap-3">
        <PageHeader
          icon={Banknote}
          title="Galla / Day close"
          subtitle="Opening cash · cash in & out · count and close the day"
          actions={
            <>
              {owner ? (
                <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" />
                  <DateInput
                    aria-label={tr("Day")}
                    value={shown}
                    max={today}
                    onChange={(e) =>
                      e.target.value &&
                      void load({
                        date: e.target.value === today ? "" : e.target.value,
                      })
                    }
                    className={cn(fieldClass, "h-8 w-[140px]")}
                  />
                </label>
              ) : null}
              {owner && view?.perCounter && view.counters.length > 1 ? (
                <select
                  aria-label={tr("Counter")}
                  value={view.counter}
                  onChange={(e) => void load({ counter: e.target.value })}
                  className={cn(fieldClass, "h-8 w-36")}
                >
                  {view.counters.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void load()}
                className="h-8 gap-1.5 rounded-lg text-[11px]"
                aria-label={tr("Refresh")}
              >
                <RefreshCw
                  className={cn("h-3.5 w-3.5", loading && "animate-spin")}
                />
              </Button>
            </>
          }
        />
        {view ? (
          <Body view={view} isToday={shown === today} owner={owner} />
        ) : null}
      </div>
    </div>
  );
}

function Body({
  view,
  isToday,
  owner,
}: {
  view: GallaView;
  isToday: boolean;
  owner: boolean;
}) {
  const { day, summary: s } = view;
  const shopName = useSettingsStore((st) => st.shop.name);
  const printer = usePrintPrefs((p) => p.printer);
  const format = usePrintPrefs((p) => p.format);
  const closed = day?.status === "closed";

  const print = () =>
    printHtml({
      html: dayReportHtml({
        shopName,
        date: view.date,
        counter: view.counter,
        day,
        summary: s,
        entries: view.entries,
      }),
      ...(format === "thermal80" ? { widthMm: 80 } : {}),
      printer,
    }).catch((e: Error) => toast.error(e.message));

  return (
    <>
      <StatusStrip view={view} onPrint={print} />
      {!day && isToday ? <StartDay view={view} /> : null}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="flex flex-col gap-3">
          <Panel
            icon={Wallet}
            title="Should be in galla"
            hint={
              closed
                ? "As it was at closing"
                : "Updates by itself with every bill"
            }
          >
            <div className="px-4 py-2">
              <Line
                label={tr(
                  day ? "Opening cash" : "Opening cash (not counted yet)",
                )}
                paise={s.openingPaise}
              />
              <Line
                sign="+"
                label={tr("Cash bills ({{n}})", { n: s.cashBills })}
                paise={s.cashSalesPaise}
              />
              <Line
                sign="+"
                label={tr("Udhaar received in cash")}
                paise={s.udhaarCollectedPaise}
              />
              <Line
                sign="+"
                label={tr("Other cash in")}
                paise={s.otherInPaise}
              />
              <Line
                sign="−"
                label={tr("Cash refunds")}
                paise={s.refundsPaise}
              />
              <Line
                sign="−"
                label={tr("Suppliers paid in cash")}
                paise={s.supplierPaidPaise}
              />
              <Line
                sign="−"
                label={tr("Expenses & other cash out")}
                paise={s.otherOutPaise}
              />
              <div className="mt-1 border-t border-dashed border-border pt-1.5">
                <Line
                  strong
                  label={tr("Should be in galla")}
                  paise={
                    closed && day.expectedPaise !== null
                      ? day.expectedPaise
                      : s.expectedPaise
                  }
                />
              </div>
              {closed && view.afterClosePaise !== 0 ? (
                <p className="mt-1 rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                  {tr(
                    "{{amt}} moved after closing (late bills or refunds) — the owner can reopen the day.",
                    {
                      amt: inrFromPaise(view.afterClosePaise),
                    },
                  )}
                </p>
              ) : null}
            </div>
          </Panel>
          <Panel
            icon={ArrowUpRight}
            title="Not in galla"
            hint="Today's other payments — for the day report"
          >
            <div className="px-4 py-2">
              <Line
                label={tr("All sales ({{n}} bills)", { n: s.bills })}
                paise={s.salesPaise}
              />
              <Line muted label="UPI" paise={s.upiPaise} />
              <Line muted label={tr("Card")} paise={s.cardPaise} />
              {s.walletPaise ? (
                <Line muted label={tr("Wallet")} paise={s.walletPaise} />
              ) : null}
              <Line
                muted
                label={tr("Udhaar given")}
                paise={s.udhaarGivenPaise}
              />
            </div>
          </Panel>
        </div>
        <div className="flex flex-col gap-3">
          <EntriesPanel view={view} owner={owner} isToday={isToday} />
          {closed ? (
            <ClosedPanel view={view} owner={owner} onPrint={print} />
          ) : day || !isToday ? (
            <CountPanel view={view} />
          ) : null}
        </div>
      </div>
    </>
  );
}

/** Not started / open since … / closed at … */
function StatusStrip({
  view,
  onPrint,
}: {
  view: GallaView;
  onPrint: () => void;
}) {
  const d = view.day;
  const label = !d
    ? tr("Day not started")
    : d.status === "open"
      ? tr("Open since {{t}} · {{who}}", {
          t: time(d.openedAt),
          who: d.openedBy,
        })
      : tr("Closed at {{t}} · {{who}}", {
          t: time(d.closedAt!),
          who: d.closedBy,
        });
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-xl border px-4 py-2.5",
        !d
          ? "border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/30"
          : d.status === "open"
            ? "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30"
            : "border-border bg-muted/40",
      )}
    >
      <span
        className={cn(
          "h-2.5 w-2.5 rounded-full",
          !d
            ? "bg-amber-500"
            : d.status === "open"
              ? "bg-emerald-500 animate-pulse"
              : "bg-slate-400",
        )}
      />
      <p className="text-[12.5px] font-semibold">{label}</p>
      <p className="text-[11px] text-muted-foreground">
        {new Date(`${view.date}T00:00`).toLocaleDateString("en-IN", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
        {view.counter ? ` · ${view.counter}` : ""}
      </p>
      <span className="ml-auto" />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onPrint}
        className="h-8 gap-1.5 rounded-lg text-[11px]"
      >
        <Printer className="h-3.5 w-3.5" />
        {tr("Print day report")}
      </Button>
    </div>
  );
}

/** Morning: count the drawer and start the day */
function StartDay({ view }: { view: GallaView }) {
  const open = useGallaStore((s) => s.open);
  const [amount, setAmount] = useState(() =>
    paiseToInput(view.suggestedOpeningPaise),
  );
  const [busy, setBusy] = useState(false);
  const paise = parseRupees(amount || "0");
  const start = async () => {
    if (paise === null)
      return toast.error(tr("Type the amount in rupees, e.g. 2000"));
    setBusy(true);
    try {
      await open(paise);
      toast.success(tr("Day started — happy billing!"));
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="flex flex-wrap items-center gap-4 rounded-xl border-2 border-dashed border-primary/40 bg-primary/[0.04] p-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Sunrise className="h-6 w-6" />
      </span>
      <div className="min-w-[220px] flex-1">
        <p className="text-[14px] font-semibold">
          {tr("Start the day: count the cash in the galla")}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {view.suggestedOpeningPaise
            ? tr(
                "Yesterday {{amt}} was left in the galla. Count it and correct if needed.",
                {
                  amt: inrFromPaise(view.suggestedOpeningPaise),
                },
              )
            : tr(
                "Change kept for the day (notes and coins). Billing works even before this.",
              )}
        </p>
      </div>
      <MoneyInput
        label={tr("Opening cash")}
        value={amount}
        onChange={setAmount}
        className="w-40"
        autoFocus
      />
      <Button
        type="button"
        data-primary
        disabled={busy}
        onClick={() => void start()}
        className="h-9 gap-1.5 rounded-lg text-[12px]"
      >
        <ArrowDownLeft className="h-4 w-4" />
        {tr("Start day")}
      </Button>
    </section>
  );
}

/** After closing: counted vs expected, kept, taken out; owner can reopen */
function ClosedPanel({
  view,
  owner,
  onPrint,
}: {
  view: GallaView;
  owner: boolean;
  onPrint: () => void;
}) {
  const d = view.day!;
  const reopen = useGallaStore((s) => s.reopen);
  const [ask, setAsk] = useState(false);
  const diff = (d.countedPaise ?? 0) - (d.expectedPaise ?? 0);
  return (
    <Panel
      icon={Lock}
      title="Day closed"
      hint={d.note ? `“${d.note}”` : undefined}
      actions={<DiffBadge paise={diff} />}
    >
      <div className="grid grid-cols-2 gap-x-6 px-4 py-3 sm:grid-cols-4">
        {[
          ["Should be", d.expectedPaise ?? 0],
          ["Counted", d.countedPaise ?? 0],
          ["Left for tomorrow", d.keptPaise ?? 0],
          ["Taken out", (d.countedPaise ?? 0) - (d.keptPaise ?? 0)],
        ].map(([k, v]) => (
          <div key={k as string}>
            <p className="text-[10.5px] text-muted-foreground">
              {tr(k as string)}
            </p>
            <p className="text-[15px] font-bold tabular-nums">
              {inrFromPaise(v as number)}
            </p>
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2 border-t border-border px-4 py-2.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onPrint}
          className="h-8 gap-1.5 rounded-lg text-[11px]"
        >
          <Printer className="h-3.5 w-3.5" />
          {tr("Print")}
        </Button>
        {owner ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAsk(true)}
            className="h-8 rounded-lg text-[11px]"
          >
            {tr("Reopen day")}
          </Button>
        ) : null}
      </div>
      <ConfirmDialog
        open={ask}
        tone="default"
        title={tr("Reopen this day?")}
        description={tr(
          "The count is cleared and the day can be counted and closed again. The day report already printed stays as it was.",
        )}
        confirmLabel={tr("Reopen")}
        cancelLabel={tr("Cancel")}
        onClose={() => setAsk(false)}
        onConfirm={() => {
          setAsk(false);
          void reopen().then(
            () => toast.success(tr("Day reopened")),
            (e) => toast.error(errMsg(e)),
          );
        }}
      />
    </Panel>
  );
}
