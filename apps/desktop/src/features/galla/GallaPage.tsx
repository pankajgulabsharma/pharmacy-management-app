import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Lock,
  Printer,
  RefreshCw,
  RotateCcw,
  Scale,
  Sunrise,
  Wallet,
} from "lucide-react";
import { businessDate, differenceOf } from "@medicare/domain/cash/galla";
import { dayReportHtml } from "@medicare/domain/cash/dayReport";
import { PAPER_FORMATS } from "@medicare/domain/printing/receipt";
import {
  inrFromPaise,
  paiseToInput,
  parseRupees,
} from "@medicare/domain/lib/money";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
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
import { DiffBadge, Group, MoneyInput, Panel, Row } from "./parts";
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
    <div className="h-full w-full overflow-y-auto bg-background">
      <div className="flex min-h-full flex-col gap-2.5 p-3">
        <PageHeader
          icon={Banknote}
          title="Galla / Day close"
          subtitle="Opening cash · cash in & out · count and close the day"
          actions={
            <>
              {owner && view?.perCounter && view.counters.length > 1 ? (
                <div
                  role="radiogroup"
                  aria-label={tr("Counter")}
                  className="flex h-8 items-center rounded-lg border border-border bg-card p-0.5"
                >
                  {view.counters.map((c) => (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={view.counter === c}
                      onClick={() => void load({ counter: c })}
                      className={cn(
                        "h-full rounded-md px-2.5 text-[11px] font-medium transition",
                        view.counter === c
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              ) : null}
              {owner ? (
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
                  className={cn(fieldClass, "h-8 w-[132px]")}
                />
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void load()}
                className="h-8 w-8 rounded-lg p-0"
                aria-label={tr("Refresh")}
                title={tr("Refresh")}
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
  const shop = useSettingsStore((st) => st.shop);
  const printer = usePrintPrefs((p) => p.printer);
  const format = usePrintPrefs((p) => p.format);
  const closed = day?.status === "closed";
  const diff = day ? differenceOf(day) : null;

  const print = () => {
    const thermal = format.startsWith("thermal");
    printHtml({
      html: dayReportHtml({
        shop,
        date: view.date,
        counter: view.counter,
        day,
        summary: s,
        entries: view.entries,
        paper: thermal ? "thermal" : "a4",
      }),
      ...(thermal ? { widthMm: PAPER_FORMATS[format].widthMm } : {}),
      printer,
    }).catch((e: Error) => toast.error(e.message));
  };

  return (
    <>
      <StatusBar view={view} isToday={isToday} onPrint={print} />

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatCard
          icon={closed ? Scale : Wallet}
          label={closed ? "Counted at closing" : "Should be in galla now"}
          value={inrFromPaise(
            closed ? (day.countedPaise ?? 0) : s.expectedPaise,
          )}
          hint={
            closed && diff !== null
              ? diff === 0
                ? tr("Matches")
                : diff < 0
                  ? tr("Short {{amt}}", { amt: inrFromPaise(-diff) })
                  : tr("Excess {{amt}}", { amt: inrFromPaise(diff) })
              : undefined
          }
          iconClass="bg-primary/10 text-primary"
        />
        <StatCard
          icon={Sunrise}
          label="Opening cash"
          value={inrFromPaise(s.openingPaise)}
          iconClass="bg-amber-500/10 text-amber-600"
        />
        <StatCard
          icon={ArrowDownLeft}
          label="Cash in"
          value={inrFromPaise(s.inPaise)}
          hint={tr("{{n}} cash bills", { n: s.cashBills })}
          iconClass="bg-emerald-500/10 text-emerald-600"
        />
        <StatCard
          icon={ArrowUpRight}
          label="Cash out"
          value={inrFromPaise(s.outPaise)}
          iconClass="bg-rose-500/10 text-rose-600"
        />
      </div>

      <div className="grid gap-2.5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="flex flex-col gap-2.5">
          <Panel
            icon={Wallet}
            title="Should be in galla"
            hint={
              closed
                ? "As it was at closing"
                : "Updates by itself with every bill"
            }
          >
            <div className="py-1">
              <Row label={tr("Opening cash")} paise={s.openingPaise} />
              <Group>{tr("Cash in")}</Group>
              <Row
                kind="in"
                label={tr("Cash bills")}
                note={s.cashBills ? `(${s.cashBills})` : undefined}
                paise={s.cashSalesPaise}
              />
              <Row
                kind="in"
                label={tr("Udhaar received in cash")}
                paise={s.udhaarCollectedPaise}
              />
              <Row
                kind="in"
                label={tr("Other cash in")}
                paise={s.otherInPaise}
              />
              <Group>{tr("Cash out")}</Group>
              <Row
                kind="out"
                label={tr("Cash refunds")}
                paise={s.refundsPaise}
              />
              <Row
                kind="out"
                label={tr("Suppliers paid in cash")}
                paise={s.supplierPaidPaise}
              />
              <Row
                kind="out"
                label={tr("Expenses & other cash out")}
                paise={s.otherOutPaise}
              />
            </div>
            <div className="border-t border-border">
              <Row
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
              <p className="border-t border-border bg-amber-50 px-4 py-2 text-[11px] text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                {tr(
                  "{{amt}} moved after closing (late bills or refunds) — the owner can reopen the day.",
                  { amt: inrFromPaise(view.afterClosePaise) },
                )}
              </p>
            ) : null}
          </Panel>

          <Panel
            icon={ArrowUpRight}
            title="Not in galla"
            hint="Today's other payments — for the day report"
          >
            <div className="py-1">
              <Row
                label={tr("All sales ({{n}} bills)", { n: s.bills })}
                paise={s.salesPaise}
              />
              <Row label="UPI" paise={s.upiPaise} />
              <Row label={tr("Card")} paise={s.cardPaise} />
              {s.walletPaise ? (
                <Row label={tr("Wallet")} paise={s.walletPaise} />
              ) : null}
              <Row label={tr("Udhaar given")} paise={s.udhaarGivenPaise} />
            </div>
          </Panel>
        </div>

        <div className="flex flex-col gap-2.5">
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

/** One slim line: the day's state — and, in the morning, Start day */
function StatusBar({
  view,
  isToday,
  onPrint,
}: {
  view: GallaView;
  isToday: boolean;
  onPrint: () => void;
}) {
  const d = view.day;
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
  const when = new Date(`${view.date}T00:00`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-4 py-2",
        !d
          ? "border-amber-200 bg-amber-50/60 dark:border-amber-900/70 dark:bg-amber-950/20"
          : "border-border bg-card",
      )}
    >
      <span
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          !d
            ? "bg-amber-500"
            : d.status === "open"
              ? "animate-pulse bg-emerald-500"
              : "bg-slate-400",
        )}
      />
      <p className="text-[12px]">
        <span className="font-semibold">
          {!d
            ? tr("Day not started")
            : d.status === "open"
              ? tr("Open since {{t}}", { t: time(d.openedAt) })
              : tr("Closed at {{t}}", { t: time(d.closedAt!) })}
        </span>
        <span className="text-muted-foreground">
          {" · "}
          {when}
          {view.counter ? ` · ${view.counter}` : ""}
          {d ? ` · ${d.status === "closed" ? d.closedBy : d.openedBy}` : ""}
        </span>
      </p>

      {!d && isToday ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void start();
          }}
          className="flex flex-1 flex-wrap items-center justify-end gap-2"
        >
          <span className="text-[11px] text-muted-foreground">
            {view.suggestedOpeningPaise
              ? tr("Left yesterday — count and correct:")
              : tr("Count the change in the galla:")}
          </span>
          <MoneyInput
            label={tr("Opening cash")}
            value={amount}
            onChange={setAmount}
            className="w-28"
            autoFocus
          />
          <Button
            type="submit"
            data-primary
            disabled={busy}
            className="h-8 gap-1.5 rounded-lg px-3 text-[11.5px]"
          >
            <Sunrise className="h-3.5 w-3.5" />
            {tr("Start day")}
          </Button>
        </form>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onPrint}
          className="ml-auto h-7 gap-1.5 rounded-lg text-[11px]"
        >
          <Printer className="h-3.5 w-3.5" />
          {tr("Print day report")}
        </Button>
      )}
    </div>
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
  const diff = counted - (d.expectedPaise ?? 0);
  return (
    <Panel
      icon={Lock}
      title="Day closed"
      hint={tr("Counted by {{who}} at {{t}}", {
        who: d.closedBy,
        t: time(d.closedAt!),
      })}
      actions={<DiffBadge paise={diff} />}
    >
      <div className="grid grid-cols-2 divide-x divide-border border-b border-border sm:grid-cols-4">
        {[
          [tr("Should be"), d.expectedPaise ?? 0],
          [tr("Counted"), counted],
          [tr("Left for tomorrow"), kept],
          [tr("Taken out"), counted - kept],
        ].map(([k, v]) => (
          <div key={k as string} className="px-4 py-2.5">
            <p className="text-[10.5px] text-muted-foreground">{k}</p>
            <p className="text-[13.5px] font-semibold tabular-nums">
              {inrFromPaise(v as number)}
            </p>
          </div>
        ))}
      </div>
      {d.note ? (
        <p className="border-b border-border px-4 py-2 text-[11.5px]">
          <span className="text-muted-foreground">{tr("Note")}: </span>
          {d.note}
        </p>
      ) : null}
      <div className="flex justify-end gap-2 px-4 py-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onPrint}
          className="h-7 gap-1.5 rounded-lg text-[11px]"
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
            className="h-7 gap-1.5 rounded-lg text-[11px]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
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
