import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  HandCoins,
  Percent,
  Stethoscope,
  Undo2,
  Wallet,
} from "lucide-react";
import type { Sale } from "@medicare/domain/billing/types";
import type { DateRange } from "@medicare/domain/reports/period";
import {
  commissionReport,
  periodOf,
  type CommissionKind,
  type CommissionRow,
} from "@medicare/domain/reports/commission";
import {
  formatPaise,
  inrFromPaise,
  rupeesToPaise,
} from "@medicare/domain/lib/money";
import { StatCard } from "@/components/common/StatCard";
import { RankBadge } from "@/components/common/RankBadge";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { FormField } from "@/components/common/FormField";
import { fieldClass } from "@/components/common/formStyles";
import { useInventoryStore } from "@/features/inventory/store/useInventoryStore";
import { ReportTable } from "@/features/reports/components/ReportTable";
import { tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useCommissionStore } from "./useCommissionStore";
import { RatesDialog } from "./RatesDialog";

const showError = (err: unknown) =>
  toast.error(err instanceof Error ? err.message : tr("Could not save"));

function HeaderButton({
  icon: Icon,
  onClick,
  children,
  disabled,
}: {
  icon: typeof Percent;
  onClick: () => void;
  children: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-[11px] font-medium hover:bg-muted disabled:opacity-50"
    >
      <Icon className="h-3.5 w-3.5" />
      {tr(children)}
    </button>
  );
}

/**
 * Doctor referrals & staff commission for the period — from the doctor's
 * name on each bill and who billed it. Owner only.
 */
export function CommissionTab({
  sales,
  range,
  periodLabel,
}: {
  sales: readonly Sale[];
  range: DateRange;
  periodLabel: string;
}) {
  const batches = useInventoryStore((s) => s.batches);
  const { rates, payouts, loaded, load, addPayout, removePayout } =
    useCommissionStore();
  useEffect(() => {
    if (!loaded) void load().catch(showError);
  }, [loaded, load]);

  const period = useMemo(() => periodOf(range), [range]);
  const r = useMemo(
    () => commissionReport(sales, batches, rates, range, payouts, period),
    [sales, batches, rates, range, payouts, period],
  );
  const [ratesOpen, setRatesOpen] = useState(false);
  const [paying, setPaying] = useState<CommissionRow | null>(null);
  const [undo, setUndo] = useState<string | null>(null);

  const doctorSales = r.doctors.reduce((a, x) => a + x.salesPaise, 0);
  const doctorBills = r.doctors.reduce((a, x) => a + x.bills, 0);
  const earned = [...r.doctors, ...r.staff].reduce(
    (a, x) => a + x.commissionPaise,
    0,
  );
  const paidHere = payouts.filter(
    (x) => x.from >= period.from && x.to <= period.to,
  );
  const profitBasis = rates.basis === "profit";

  const table = (kind: CommissionKind, rows: CommissionRow[]) => (
    <ReportTable
      title={kind === "doctor" ? "Doctor referrals" : "Staff commission"}
      subtitle={
        kind === "doctor"
          ? tr("Bills with the doctor's name · {{period}}", {
              period: periodLabel,
            })
          : tr("Bills each person made · {{period}}", { period: periodLabel })
      }
      rows={rows}
      getKey={(x) => x.name}
      empty={
        kind === "doctor"
          ? "No bill in this period has a doctor's name — pick the doctor on the bill (Billing → Doctor)."
          : "No bills in this period"
      }
      action={
        kind === "doctor" ? (
          <HeaderButton icon={Percent} onClick={() => setRatesOpen(true)}>
            Rates
          </HeaderButton>
        ) : undefined
      }
      columns={[
        {
          key: "rank",
          label: "#",
          width: "w-[48px]",
          render: (x) => <RankBadge rank={rows.indexOf(x) + 1} />,
        },
        {
          key: "name",
          label: kind === "doctor" ? "Doctor" : "Staff",
          render: (x) => (
            <>
              {x.name}
              <span className="block text-[10px] text-muted-foreground">
                {x.bills === 1
                  ? tr("1 bill")
                  : tr("{{n}} bills", { n: x.bills })}
              </span>
            </>
          ),
        },
        {
          key: "sales",
          label: "Sales (₹)",
          align: "right",
          width: "w-[100px]",
          render: (x) => formatPaise(x.salesPaise),
        },
        ...(profitBasis
          ? [
              {
                key: "profit",
                label: "Profit (₹)",
                align: "right" as const,
                width: "w-[100px]",
                render: (x: CommissionRow) => formatPaise(x.profitPaise),
              },
            ]
          : []),
        {
          key: "rate",
          label: "Rate",
          align: "right",
          width: "w-[64px]",
          render: (x) =>
            x.ratePct ? (
              `${x.ratePct}%`
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
        },
        {
          key: "commission",
          label: "Commission (₹)",
          align: "right",
          width: "w-[110px]",
          render: (x) => (
            <b className="tabular-nums">
              {x.commissionPaise ? formatPaise(x.commissionPaise) : "—"}
            </b>
          ),
        },
        {
          key: "status",
          label: "Paid / due",
          align: "right",
          width: "w-[150px]",
          render: (x) =>
            !x.commissionPaise ? (
              <span className="text-muted-foreground">—</span>
            ) : x.duePaise === 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                {tr("Paid")}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setPaying(x)}
                className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-500/20 hover:bg-amber-500/20 dark:text-amber-400"
                title={tr("Mark paid")}
              >
                {tr("Due {{amount}}", { amount: inrFromPaise(x.duePaise) })}
                <span className="text-primary">· {tr("Pay")}</span>
              </button>
            ),
        },
      ]}
    />
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <StatCard
          icon={Stethoscope}
          label="Bills with a doctor"
          value={`${doctorBills} · ${inrFromPaise(doctorSales)}`}
          iconClass="bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400"
        />
        <StatCard
          icon={HandCoins}
          label="Commission this period"
          value={inrFromPaise(earned)}
          hint={tr(profitBasis ? "on profit" : "on bill amount")}
          iconClass="bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-400"
        />
        <StatCard
          icon={Wallet}
          label="Still to pay"
          value={inrFromPaise(r.totalDuePaise)}
          iconClass={cn(
            r.totalDuePaise
              ? "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400"
              : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
          )}
        />
      </div>

      {table("doctor", r.doctors)}
      {table("staff", r.staff)}

      {paidHere.length ? (
        <ReportTable
          title="Paid for this period"
          rows={paidHere}
          getKey={(x) => x.id}
          empty=""
          columns={[
            {
              key: "when",
              label: "Paid on",
              width: "w-[120px]",
              render: (x) =>
                new Date(x.paidAt).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "2-digit",
                }),
            },
            {
              key: "name",
              label: "To",
              render: (x) => (
                <>
                  {x.name}
                  <span className="block text-[10px] text-muted-foreground">
                    {tr(x.kind === "doctor" ? "Doctor" : "Staff")}
                    {x.note ? ` · ${x.note}` : ""}
                  </span>
                </>
              ),
            },
            {
              key: "amount",
              label: "Amount (₹)",
              align: "right",
              width: "w-[110px]",
              render: (x) => formatPaise(x.amountPaise),
            },
            {
              key: "undo",
              label: "",
              align: "right",
              width: "w-[80px]",
              render: (x) => (
                <button
                  type="button"
                  onClick={() => setUndo(x.id)}
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-red-600"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                  {tr("Undo")}
                </button>
              ),
            },
          ]}
        />
      ) : null}

      {ratesOpen ? (
        <RatesDialog
          billDoctors={r.doctors.map((x) => x.name)}
          billStaff={r.staff.map((x) => x.name)}
          onClose={() => setRatesOpen(false)}
        />
      ) : null}
      {paying ? (
        <PayDialog
          row={paying}
          periodLabel={periodLabel}
          onPay={(amountPaise, note) =>
            addPayout({
              kind: paying.kind,
              name: paying.name,
              ...period,
              amountPaise,
              note,
            }).then(() => {
              toast.success(
                tr("Paid {{amount}} to {{name}}", {
                  amount: inrFromPaise(amountPaise),
                  name: paying.name,
                }),
              );
              setPaying(null);
            }, showError)
          }
          onClose={() => setPaying(null)}
        />
      ) : null}
      <ConfirmDialog
        open={undo !== null}
        title={tr("Undo this payout?")}
        description={tr("The amount shows as due again.")}
        confirmLabel="Undo"
        onConfirm={() => {
          const id = undo!;
          setUndo(null);
          removePayout(id).then(
            () => toast.success(tr("Payout removed")),
            showError,
          );
        }}
        onClose={() => setUndo(null)}
      />
    </div>
  );
}

const MODES = ["Cash", "UPI", "Cheque", "Bank transfer"] as const;

function PayDialog({
  row,
  periodLabel,
  onPay,
  onClose,
}: {
  row: CommissionRow;
  periodLabel: string;
  onPay: (amountPaise: number, note: string) => void;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(String(row.duePaise / 100));
  const [mode, setMode] = useState<string>("Cash");
  const paise = rupeesToPaise(Number(amount));
  const ok = Number.isFinite(paise) && paise > 0;
  return (
    <ConfirmDialog
      open
      tone="default"
      icon={HandCoins}
      title={tr("Pay {{name}}", { name: row.name })}
      description={tr("For {{period}} · due {{amount}}", {
        period: periodLabel,
        amount: inrFromPaise(row.duePaise),
      })}
      confirmLabel="Mark paid"
      cancelLabel="Cancel"
      confirmDisabled={!ok}
      onConfirm={() => onPay(paise, mode)}
      onClose={onClose}
    >
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Amount (₹)" htmlFor="pay-amount">
          <input
            id="pay-amount"
            data-autofocus
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={cn(fieldClass, "tabular-nums")}
          />
        </FormField>
        <FormField label="Paid by" htmlFor="pay-mode">
          <select
            id="pay-mode"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className={fieldClass}
          >
            {MODES.map((m) => (
              <option key={m} value={m}>
                {tr(m)}
              </option>
            ))}
          </select>
        </FormField>
      </div>
    </ConfirmDialog>
  );
}
