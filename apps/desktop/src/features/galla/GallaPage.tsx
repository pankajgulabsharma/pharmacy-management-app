import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowDownLeft,
  ArrowDownToLine,
  ArrowUpFromLine,
  CalendarDays,
  CreditCard,
  HandCoins,
  Lock,
  Printer,
  Receipt,
  RefreshCw,
  RotateCcw,
  Smartphone,
  Sunrise,
  Truck,
  Undo2,
  Wallet,
} from "lucide-react";
import {
  businessDate,
  DIFF_TOLERANCE_PAISE,
  differenceOf,
} from "@medicare/domain/cash/galla";
import { dayReportHtml } from "@medicare/domain/cash/dayReport";
import {
  inrFromPaise,
  paiseToInput,
  parseRupees,
} from "@medicare/domain/lib/money";
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
import { FlowRow, MoneyInput, Panel } from "./parts";
import { time } from "./format";
import { EntriesPanel } from "./EntriesPanel";
import { CountPanel } from "./CountPanel";

const errMsg = (e: unknown) =>
  e instanceof Error ? e.message : tr("Could not save");

const longDate = (date: string) =>
  new Date(`${date}T00:00`).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

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
    <div className="h-full w-full overflow-y-auto bg-background">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-5">
        {/* Title + the day / counter being looked at */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[20px] font-bold tracking-tight">
              {tr("Galla / Day close")}
            </h1>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              {longDate(shown)}
              {view?.counter ? ` · ${view.counter}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {owner ? (
              <label className="relative">
                <CalendarDays className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
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
                  className={cn(fieldClass, "h-9 w-[150px] pl-8")}
                />
              </label>
            ) : null}
            {owner && view?.perCounter && view.counters.length > 1 ? (
              <div
                role="radiogroup"
                aria-label={tr("Counter")}
                className="flex rounded-xl border border-border bg-card p-1"
              >
                {view.counters.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={view.counter === c}
                    onClick={() => void load({ counter: c })}
                    className={cn(
                      "h-7 rounded-lg px-3 text-[11.5px] font-medium transition",
                      view.counter === c
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            ) : null}
            {shown !== today && owner ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void load({ date: "" })}
                className="h-9 rounded-xl text-[12px]"
              >
                {tr("Today")}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void load()}
              className="h-9 w-9 rounded-xl p-0"
              aria-label={tr("Refresh")}
              title={tr("Refresh")}
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
        </div>

        {view ? (
          <Body view={view} isToday={shown === today} owner={owner} />
        ) : (
          <div className="h-48 animate-pulse rounded-3xl bg-muted" />
        )}
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

  const max = Math.max(
    s.cashSalesPaise,
    s.udhaarCollectedPaise,
    s.otherInPaise,
    s.refundsPaise,
    s.supplierPaidPaise,
    s.otherOutPaise,
  );

  return (
    <>
      <Hero view={view} onPrint={print} />
      {!day && isToday ? <StartDay view={view} /> : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="flex flex-col gap-5">
          <Panel
            icon={Wallet}
            title="Where the galla money came from"
            hint={
              closed
                ? "As it was at closing"
                : "Updates by itself with every bill"
            }
          >
            <p className="px-5 pb-1 text-[10.5px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              {tr("Cash in")}
            </p>
            <ul>
              <FlowRow
                kind="in"
                icon={Receipt}
                label={tr("Cash bills")}
                note={tr("{{n}} bills paid in cash (or part cash)", {
                  n: s.cashBills,
                })}
                paise={s.cashSalesPaise}
                max={max}
              />
              <FlowRow
                kind="in"
                icon={HandCoins}
                label={tr("Udhaar received in cash")}
                paise={s.udhaarCollectedPaise}
                max={max}
              />
              <FlowRow
                kind="in"
                icon={ArrowDownToLine}
                label={tr("Other cash in")}
                note={tr("Change added, other income")}
                paise={s.otherInPaise}
                max={max}
              />
            </ul>
            <p className="mt-2 border-t border-border/70 px-5 pb-1 pt-3 text-[10.5px] font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400">
              {tr("Cash out")}
            </p>
            <ul>
              <FlowRow
                kind="out"
                icon={Undo2}
                label={tr("Cash refunds")}
                note={tr("Sales returns paid back in cash")}
                paise={s.refundsPaise}
                max={max}
              />
              <FlowRow
                kind="out"
                icon={Truck}
                label={tr("Suppliers paid in cash")}
                paise={s.supplierPaidPaise}
                max={max}
              />
              <FlowRow
                kind="out"
                icon={ArrowUpFromLine}
                label={tr("Expenses & other cash out")}
                note={tr("Tea, salary advance, bank deposit…")}
                paise={s.otherOutPaise}
                max={max}
              />
            </ul>
            {closed && view.afterClosePaise !== 0 ? (
              <p className="mx-5 mb-4 mt-2 rounded-xl bg-amber-50 px-3 py-2 text-[11.5px] text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                {tr(
                  "{{amt}} moved after closing (late bills or refunds) — the owner can reopen the day.",
                  { amt: inrFromPaise(view.afterClosePaise) },
                )}
              </p>
            ) : (
              <div className="h-3" />
            )}
          </Panel>

          <Panel
            icon={Smartphone}
            title="Not in galla"
            hint="Today's other payments — for the day report"
          >
            <div className="grid grid-cols-2 gap-3 px-5 pb-5 sm:grid-cols-4">
              <Mini
                label={tr("All sales")}
                sub={tr("{{n}} bills", { n: s.bills })}
                paise={s.salesPaise}
                strong
              />
              <Mini label="UPI" paise={s.upiPaise} icon={Smartphone} />
              <Mini
                label={tr("Card")}
                paise={s.cardPaise + s.walletPaise}
                icon={CreditCard}
              />
              <Mini
                label={tr("Udhaar given")}
                paise={s.udhaarGivenPaise}
                icon={HandCoins}
              />
            </div>
          </Panel>
        </div>

        <div className="flex flex-col gap-5">
          {closed ? (
            <ClosedPanel view={view} owner={owner} onPrint={print} />
          ) : day || !isToday ? (
            <CountPanel view={view} />
          ) : null}
          <EntriesPanel view={view} owner={owner} isToday={isToday} />
        </div>
      </div>
    </>
  );
}

function Mini({
  label,
  sub,
  paise,
  icon: Icon,
  strong,
}: {
  label: string;
  sub?: string;
  paise: number;
  icon?: typeof Smartphone;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5",
        strong
          ? "border-primary/25 bg-primary/[0.05]"
          : "border-border bg-muted/30",
      )}
    >
      <p className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
        {Icon ? <Icon className="h-3 w-3" /> : null}
        {label}
        {sub ? <span className="ml-auto">{sub}</span> : null}
      </p>
      <p className="mt-1 text-[15px] font-bold tabular-nums">
        {inrFromPaise(paise)}
      </p>
    </div>
  );
}

/**
 * The big number: what should be in the drawer right now (or what was
 * counted at closing), the day's status, and opening / in / out.
 */
function Hero({ view, onPrint }: { view: GallaView; onPrint: () => void }) {
  const d = view.day;
  const s = view.summary;
  const closed = d?.status === "closed";
  const diff = d ? differenceOf(d) : null;
  const status = !d
    ? { dot: "bg-amber-300", text: tr("Day not started") }
    : d.status === "open"
      ? {
          dot: "bg-emerald-300 animate-pulse",
          text: tr("Open since {{t}} · {{who}}", {
            t: time(d.openedAt),
            who: d.openedBy,
          }),
        }
      : {
          dot: "bg-slate-300",
          text: tr("Closed at {{t}} · {{who}}", {
            t: time(d.closedAt!),
            who: d.closedBy,
          }),
        };
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 p-6 text-white shadow-lg shadow-indigo-900/20">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 right-40 h-56 w-56 rounded-full bg-white/[0.06]"
      />
      <div className="relative flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11.5px] font-medium backdrop-blur">
            <span className={cn("h-2 w-2 rounded-full", status.dot)} />
            {status.text}
          </span>
          <p className="mt-4 text-[12.5px] text-white/75">
            {tr(closed ? "Counted at closing" : "Should be in galla now")}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <p className="text-[38px] font-bold leading-none tracking-tight tabular-nums">
              {inrFromPaise(closed ? (d.countedPaise ?? 0) : s.expectedPaise)}
            </p>
            {diff !== null ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[12.5px] font-semibold tabular-nums shadow-sm",
                  Math.abs(diff) <= DIFF_TOLERANCE_PAISE
                    ? "text-emerald-700"
                    : diff < 0
                      ? "text-rose-700"
                      : "text-sky-700",
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    Math.abs(diff) <= DIFF_TOLERANCE_PAISE
                      ? "bg-emerald-500"
                      : diff < 0
                        ? "bg-rose-500"
                        : "bg-sky-500",
                  )}
                />
                {Math.abs(diff) <= DIFF_TOLERANCE_PAISE
                  ? tr("Matches")
                  : diff < 0
                    ? tr("Short {{amt}}", { amt: inrFromPaise(-diff) })
                    : tr("Excess {{amt}}", { amt: inrFromPaise(diff) })}
              </span>
            ) : null}
          </div>
          {closed && d.expectedPaise !== null ? (
            <p className="mt-2 text-[12px] text-white/75">
              {tr("Should have been {{amt}}", {
                amt: inrFromPaise(d.expectedPaise),
              })}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          onClick={onPrint}
          className="h-9 gap-2 rounded-xl bg-white/15 text-[12px] text-white shadow-none ring-1 ring-white/25 backdrop-blur hover:bg-white/25"
        >
          <Printer className="h-4 w-4" />
          {tr("Print day report")}
        </Button>
      </div>
      <div className="relative mt-6 grid grid-cols-3 gap-3">
        <HeroStat
          label={tr("Opening cash")}
          paise={s.openingPaise}
          icon={Sunrise}
        />
        <HeroStat
          label={tr("Cash in")}
          paise={s.inPaise}
          icon={ArrowDownLeft}
          sign="+"
        />
        <HeroStat
          label={tr("Cash out")}
          paise={s.outPaise}
          icon={RotateCcw}
          sign="−"
        />
      </div>
    </section>
  );
}

function HeroStat({
  label,
  paise,
  icon: Icon,
  sign,
}: {
  label: string;
  paise: number;
  icon: typeof Sunrise;
  sign?: "+" | "−";
}) {
  return (
    <div className="rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/15 backdrop-blur">
      <p className="flex items-center gap-1.5 text-[11px] text-white/70">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>
      <p className="mt-1 text-[17px] font-semibold tabular-nums">
        {sign && paise ? `${sign} ` : ""}
        {inrFromPaise(paise)}
      </p>
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
  const start = async () => {
    const paise = parseRupees(amount || "0");
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
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void start();
      }}
      className="flex flex-wrap items-center gap-5 rounded-2xl border border-amber-300/60 bg-gradient-to-r from-amber-50 to-orange-50/40 p-5 shadow-sm dark:border-amber-900/60 dark:from-amber-950/30 dark:to-transparent"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
        <Sunrise className="h-6 w-6" />
      </span>
      <div className="min-w-[240px] flex-1">
        <p className="text-[15px] font-semibold">
          {tr("Start the day: count the cash in the galla")}
        </p>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          {view.suggestedOpeningPaise
            ? tr(
                "Yesterday {{amt}} was left in the galla. Count it and correct if needed.",
                { amt: inrFromPaise(view.suggestedOpeningPaise) },
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
        className="w-44"
        size="lg"
        autoFocus
      />
      <Button
        type="submit"
        data-primary
        disabled={busy}
        className="h-11 gap-2 rounded-xl px-5 text-[13px]"
      >
        <Sunrise className="h-4 w-4" />
        {tr("Start day")}
      </Button>
    </form>
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
  const counted = d.countedPaise ?? 0;
  const kept = d.keptPaise ?? 0;
  return (
    <Panel
      icon={Lock}
      tone="emerald"
      title="Day closed"
      hint={tr("Counted by {{who}} at {{t}}", {
        who: d.closedBy,
        t: time(d.closedAt!),
      })}
    >
      <div className="grid grid-cols-2 gap-3 px-5 pb-4">
        <Fact
          label={tr("Should be")}
          value={inrFromPaise(d.expectedPaise ?? 0)}
        />
        <Fact label={tr("Counted")} value={inrFromPaise(counted)} strong />
        <Fact label={tr("Left for tomorrow")} value={inrFromPaise(kept)} />
        <Fact
          label={tr("Taken out (owner / bank)")}
          value={inrFromPaise(counted - kept)}
        />
      </div>
      {d.note ? (
        <p className="mx-5 mb-4 rounded-xl bg-muted/50 px-3 py-2 text-[12px]">
          <span className="text-muted-foreground">{tr("Note")}: </span>
          {d.note}
        </p>
      ) : null}
      <div className="flex justify-end gap-2 border-t border-border bg-muted/20 px-5 py-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onPrint}
          className="h-9 gap-1.5 rounded-xl text-[12px]"
        >
          <Printer className="h-4 w-4" />
          {tr("Print")}
        </Button>
        {owner ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAsk(true)}
            className="h-9 gap-1.5 rounded-xl text-[12px]"
          >
            <RotateCcw className="h-4 w-4" />
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

function Fact({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3.5 py-3",
        strong ? "border-primary/25 bg-primary/[0.05]" : "border-border",
      )}
    >
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-[17px] font-bold tabular-nums">{value}</p>
    </div>
  );
}
