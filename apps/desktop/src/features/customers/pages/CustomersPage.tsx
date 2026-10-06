import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BookUser,
  FileText,
  HandCoins,
  IndianRupee,
  Pencil,
  Plus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { SearchInput } from "@/components/common/SearchInput";
import {
  FilterChips,
  type FilterChipOption,
} from "@/components/common/FilterChips";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { KeyHints } from "@/components/common/KeyHints";
import { Kbd } from "@/components/common/Kbd";
import { useHotkeys } from "@/hooks/useHotkeys";
import { SELECTED_ROW, useListNavigation } from "@/hooks/useListNavigation";
import { oneOf, useUrlIntent } from "@/hooks/useUrlIntent";
import { KEYS } from "@/app/shortcuts/registry";
import { cn } from "@/lib/utils";
import { formatPaise, inrRounded } from "@/lib/money";
import { tr } from "@/lib/i18n";
import { useCustomerStore } from "../store/useCustomerStore";
import { useCustomerSummaries } from "../hooks/useCustomerSummaries";
import {
  CUSTOMER_STATUS_LABEL,
  CUSTOMER_STATUS_TONE,
  customerStatus,
  type CustomerStatus,
} from "../utils/status";
import { totalUdhaar, type CustomerSummary } from "../utils/ledger";
import type { Customer } from "../types";
import { CustomerFormDialog } from "../components/CustomerFormDialog";
import { ReceivePaymentDialog } from "../components/ReceivePaymentDialog";
import { CustomerStatementDialog } from "../components/CustomerStatementDialog";

/** "All" + one chip per status; chips never overlap and add up to All */
type Filter = "all" | CustomerStatus;
const FILTERS: readonly Filter[] = ["all", "due", "over", "clear", "inactive"];
type Row = Customer & { sum: CustomerSummary; overLimit: boolean };

const COLUMNS: { key: string; label: string; width?: string; align: string }[] =
  [
    { key: "customer", label: "Customer", align: "text-left" },
    {
      key: "bills",
      label: "Udhaar bills",
      width: "w-[96px]",
      align: "text-right",
    },
    {
      key: "given",
      label: "Given (₹)",
      width: "w-[112px]",
      align: "text-right",
    },
    {
      key: "received",
      label: "Received (₹)",
      width: "w-[120px]",
      align: "text-right",
    },
    { key: "owes", label: "Owes (₹)", width: "w-[112px]", align: "text-right" },
    {
      key: "last",
      label: "Last activity",
      width: "w-[116px]",
      align: "text-left",
    },
    { key: "status", label: "Status", width: "w-[104px]", align: "text-left" },
    { key: "actions", label: "", width: "w-[276px]", align: "text-right" },
  ];

/** Same function for the chip, its count and the Status column */
const statusOf = (r: Row) => customerStatus(r, r.sum);

const dateShort = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

type ActionTone = "neutral" | "money" | "edit";

/** Colour says what the action does: grey = view, green = money in, indigo = change */
const ACTION_TONE: Record<ActionTone, string> = {
  neutral:
    "bg-slate-100 text-slate-700 ring-slate-200 hover:bg-slate-200/80 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-700",
  money:
    "bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900 dark:hover:bg-emerald-900/60",
  edit: "bg-indigo-50 text-indigo-700 ring-indigo-200 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-300 dark:ring-indigo-900 dark:hover:bg-indigo-900/60",
};

function ActionButton({
  icon: Icon,
  label,
  tone,
  onClick,
  disabled,
  disabledHint,
}: {
  icon: typeof FileText;
  label: string;
  tone: ActionTone;
  onClick: () => void;
  disabled?: boolean;
  disabledHint?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={disabled ? tr(disabledHint ?? "") : tr(label)}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[11.5px] font-medium ring-1 ring-inset",
        "transition-all hover:-translate-y-px hover:shadow-sm active:translate-y-0",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-40",
        ACTION_TONE[tone],
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {tr(label)}
    </button>
  );
}

export default function CustomersPage() {
  const customers = useCustomerStore((s) => s.customers);
  const payments = useCustomerStore((s) => s.payments);
  const sums = useCustomerSummaries();
  const intent = useUrlIntent();
  const [query, setQuery] = useState(intent.q?.slice(0, 60) ?? "");
  const dq = useDeferredValue(query);
  const [filter, setFilter] = useState<Filter>(
    oneOf(intent.filter, FILTERS, "all"),
  );
  const [form, setForm] = useState<{
    open: boolean;
    customer: Customer | null;
  }>({ open: intent.new === "1", customer: null });
  const [viewId, setViewId] = useState<string | null>(null);
  const [payId, setPayId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const rows = useMemo<Row[]>(
    () =>
      customers
        .map((c) => {
          const sum = sums.get(c.id)!;
          return {
            ...c,
            sum,
            overLimit:
              c.creditLimitPaise > 0 && sum.balancePaise > c.creditLimitPaise,
          };
        })
        // Most owed first — that's who to call
        .sort(
          (a, b) =>
            b.sum.balancePaise - a.sum.balancePaise ||
            a.name.localeCompare(b.name),
        ),
    [customers, sums],
  );

  const counts = useMemo(() => {
    const c: Record<Filter, number> = {
      all: rows.length,
      due: 0,
      over: 0,
      clear: 0,
      inactive: 0,
    };
    for (const r of rows) c[statusOf(r)]++;
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = dq.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "all" && statusOf(r) !== filter) return false;
      return (
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.phone.includes(q.replace(/\D/g, "") || "\u0000")
      );
    });
  }, [rows, dq, filter]);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const collectedThisMonth = payments
    .filter((p) => new Date(p.at) >= monthStart)
    .reduce((a, p) => a + p.amountPaise, 0);

  const options: FilterChipOption<Filter>[] = [
    { id: "all", label: "All", count: counts.all },
    ...FILTERS.filter((f): f is CustomerStatus => f !== "all").map((f) => ({
      id: f,
      label: CUSTOMER_STATUS_LABEL[f],
      count: counts[f],
    })),
  ];

  const nav = useListNavigation({
    items: filtered,
    getKey: (r: Row) => r.id,
    onOpen: (r) => setViewId(r.id),
  });
  useEffect(() => {
    if (!nav.selectedKey) return;
    document
      .querySelector<HTMLElement>(
        `[data-row-id="${CSS.escape(nav.selectedKey)}"]`,
      )
      ?.scrollIntoView({ block: "nearest" });
  }, [nav.selectedKey]);
  useHotkeys([
    { keys: KEYS.focusSearch, handler: () => searchRef.current?.select() },
    {
      keys: KEYS.create,
      handler: () => setForm({ open: true, customer: null }),
    },
    {
      keys: KEYS.edit,
      enabled: nav.selected !== null,
      handler: () =>
        nav.selected && setForm({ open: true, customer: nav.selected }),
    },
    {
      keys: "P",
      enabled: (nav.selected?.sum.balancePaise ?? 0) > 0,
      handler: () => nav.selected && setPayId(nav.selected.id),
    },
  ]);

  const viewing = customers.find((c) => c.id === viewId) ?? null;
  const paying = customers.find((c) => c.id === payId) ?? null;

  return (
    <div className="h-full w-full p-3 overflow-hidden box-border bg-background flex flex-col gap-2.5 min-h-0">
      <PageHeader
        icon={BookUser}
        title="Customers & Udhaar"
        subtitle="Customer accounts · udhaar bills · payments received"
        actions={
          <Button
            type="button"
            onClick={() => setForm({ open: true, customer: null })}
            className="h-9 rounded-lg text-[12px] gap-1.5"
          >
            <Plus className="h-4 w-4" />
            {tr("New customer")}
            <Kbd keys={KEYS.create} tone="light" />
          </Button>
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 shrink-0">
        <StatCard
          icon={Users}
          label="Customer accounts"
          value={String(counts.all)}
          iconClass="bg-primary/10 text-primary"
          hint={`${counts.due + counts.over} ${tr("with dues")}`}
        />
        <StatCard
          icon={IndianRupee}
          label="Udhaar to collect"
          value={inrRounded(totalUdhaar(sums))}
          iconClass="bg-red-500/10 text-red-500"
          hint="Total owed by customers"
        />
        <StatCard
          icon={AlertTriangle}
          label="Over limit"
          value={String(counts.over)}
          iconClass="bg-orange-500/10 text-orange-600"
          hint="Udhaar above their limit"
        />
        <StatCard
          icon={HandCoins}
          label="Collected this month"
          value={inrRounded(collectedThisMonth)}
          iconClass="bg-emerald-500/10 text-emerald-600"
          hint="Payments received"
        />
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search name or mobile..."
          inputRef={searchRef}
        />
        <FilterChips
          options={options}
          value={filter}
          onChange={setFilter}
          ariaLabel="Customer filter"
        />
      </div>

      <div className="flex items-center justify-between gap-3 shrink-0">
        <p className="text-[10px] text-muted-foreground">
          {tr("Showing {{shown}} of {{total}}", {
            shown: filtered.length,
            total: rows.length,
          })}{" "}
          · {tr("Most owed first")}
        </p>
        <KeyHints
          hints={[
            { keys: ["ArrowUp", "ArrowDown"], label: "Move" },
            { keys: "Enter", label: "Statement" },
            { keys: "P", label: "Receive payment" },
            { keys: "E", label: "Edit" },
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={BookUser}
          title="No customers found"
          description="Try another name or mobile, or add a new customer."
        />
      ) : (
        <div className="flex-1 min-h-0 rounded-xl border border-border bg-card overflow-auto">
          <table className="w-full min-w-[1060px] table-fixed text-[12px] border-collapse">
            {/* Fixed widths; only "Customer" takes the spare room */}
            <colgroup>
              {COLUMNS.map((c) => (
                <col key={c.key} className={c.width} />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-10">
              <tr>
                {COLUMNS.map((c) => (
                  <th
                    key={c.key}
                    scope="col"
                    className={cn(
                      "h-10 px-4 bg-primary text-primary-foreground text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap",
                      c.align,
                    )}
                  >
                    {tr(c.label)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  data-row-id={r.id}
                  aria-selected={nav.selectedKey === r.id}
                  onClick={() => nav.select(r)}
                  onDoubleClick={() => setViewId(r.id)}
                  className={cn(
                    "border-b border-border/60 last:border-0 [&>td]:align-middle hover:bg-muted/30 cursor-pointer",
                    // Inactive: fade the data, not the buttons (Edit re-activates the account)
                    r.status === "inactive" &&
                      "[&>td:not(:last-child)]:opacity-60",
                    nav.selectedKey === r.id && SELECTED_ROW,
                  )}
                >
                  <td className="px-4 py-2.5">
                    <p className="font-medium truncate" title={r.name}>
                      {r.name}
                    </p>
                    <p className="text-[10.5px] text-muted-foreground tabular-nums truncate">
                      {r.phone || tr("No mobile")}
                      {r.creditLimitPaise
                        ? ` · ${tr("limit")} ${inrRounded(r.creditLimitPaise)}`
                        : ""}
                    </p>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {r.sum.udhaarBills}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatPaise(r.sum.billedPaise)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                    {formatPaise(r.sum.receivedPaise + r.sum.adjustedPaise)}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-2.5 text-right tabular-nums font-semibold",
                      r.sum.balancePaise > 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-muted-foreground",
                    )}
                  >
                    {formatPaise(r.sum.balancePaise)}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                    {r.sum.lastActivity
                      ? dateShort.format(new Date(r.sum.lastActivity))
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge
                      tone={CUSTOMER_STATUS_TONE[statusOf(r)]}
                      size="xs"
                    >
                      {CUSTOMER_STATUS_LABEL[statusOf(r)]}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-2.5">
                    {/* Three separate actions — each does one job */}
                    <div className="flex justify-end gap-1.5">
                      <ActionButton
                        icon={FileText}
                        label="Statement"
                        tone="neutral"
                        onClick={() => setViewId(r.id)}
                      />
                      <ActionButton
                        icon={HandCoins}
                        label="Receive"
                        tone="money"
                        disabled={r.sum.balancePaise <= 0}
                        disabledHint="Nothing owed"
                        onClick={() => setPayId(r.id)}
                      />
                      <ActionButton
                        icon={Pencil}
                        label="Edit"
                        tone="edit"
                        onClick={() => setForm({ open: true, customer: r })}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CustomerFormDialog
        open={form.open}
        customer={form.customer}
        onClose={() => setForm({ open: false, customer: null })}
      />
      <CustomerStatementDialog
        customer={viewing}
        onClose={() => setViewId(null)}
      />
      <ReceivePaymentDialog
        customer={paying}
        owedPaise={paying ? (sums.get(paying.id)?.balancePaise ?? 0) : 0}
        onClose={() => setPayId(null)}
      />
    </div>
  );
}
