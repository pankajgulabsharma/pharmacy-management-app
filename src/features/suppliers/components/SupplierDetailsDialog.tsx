import { useId, useMemo } from "react";
import { Building2, Lock, Mail, Pencil, Phone, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalShell } from "@/components/common/ModalShell";
import { StatusBadge } from "@/components/common/StatusBadge";
import { CodeChip } from "@/components/common/CodeChip";
import { usePurchaseStore } from "@/features/purchases/store/usePurchaseStore";
import { getDuePaise, getPaymentStatus } from "@/features/purchases/utils/calc";
import {
  PAYMENT_STATUS_META,
  RETURN_REASONS,
} from "@/features/purchases/types";
import { formatISODate } from "@/lib/date";
import { formatPaise, inrFromPaise } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { SupplierWithSummary } from "../types";
import { checkGstin } from "../utils/gstin";

type Props = {
  supplier: SupplierWithSummary | null;
  today: Date;
  onClose: () => void;
  onEdit: (s: SupplierWithSummary) => void;
  onDelete: (s: SupplierWithSummary) => void;
};

const RECENT = 8;

export function SupplierDetailsDialog({ supplier, ...rest }: Props) {
  if (!supplier) return null;
  return <Details key={supplier.id} s={supplier} {...rest} />;
}

function Details({
  s,
  today,
  onClose,
  onEdit,
  onDelete,
}: Omit<Props, "supplier"> & { s: SupplierWithSummary }) {
  const titleId = useId();
  const purchases = usePurchaseStore((st) => st.purchases);
  const returns = usePurchaseStore((st) => st.returns);

  const { recentInvoices, recentReturns, hasHistory } = useMemo(() => {
    const mine = purchases.filter((p) => p.supplierId === s.id);
    const myReturns = returns.filter((r) => r.supplierId === s.id);
    return {
      recentInvoices: [...mine]
        .sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate))
        .slice(0, RECENT),
      recentReturns: myReturns.slice(0, 5),
      hasHistory: mine.length > 0 || myReturns.length > 0,
    };
  }, [purchases, returns, s.id]);

  const gst = checkGstin(s.gstin);

  return (
    <ModalShell
      open
      onClose={onClose}
      labelledBy={titleId}
      className="max-w-4xl max-h-[92vh] flex flex-col overflow-hidden"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 id={titleId} className="text-sm font-semibold truncate">
              {s.name}
            </h2>
            <p className="text-[10px] text-muted-foreground truncate">
              GSTIN {s.gstin}
              {gst.ok ? ` · ${gst.stateName}` : ""}
            </p>
          </div>
          <StatusBadge
            tone={s.status === "active" ? "success" : "neutral"}
            className="ml-1"
          >
            {s.status === "active" ? "Active" : "Inactive"}
          </StatusBadge>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="border-b border-border px-4 py-2 shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onEdit(s)}
            className="h-8 rounded-lg text-[11px] gap-1.5"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={hasHistory}
            title={
              hasHistory
                ? "Has invoices — set Inactive instead"
                : "Delete supplier"
            }
            onClick={() => onDelete(s)}
            className="h-8 rounded-lg text-[11px] gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
        {hasHistory ? (
          <p className="mt-1.5 flex items-start gap-1.5 text-[10px] text-muted-foreground">
            <Lock className="h-3 w-3 shrink-0 mt-px" />
            This supplier has invoices, so it can't be deleted (your records
            need it). Edit it and set the status to Inactive instead.
          </p>
        ) : null}
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-4 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Money label="Purchased" value={s.purchasedPaise} />
          <Money
            label="Outstanding"
            value={s.outstandingPaise}
            tone={s.outstandingPaise > 0 ? "warn" : undefined}
          />
          <Money
            label={`Overdue (${s.overdueCount})`}
            value={s.overduePaise}
            tone={s.overduePaise > 0 ? "danger" : undefined}
          />
          <Money
            label="Credit with supplier"
            value={s.creditPaise}
            tone={s.creditPaise > 0 ? "good" : undefined}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
          <Info label="Contact person" value={s.contactPerson || "—"} />
          <div className="rounded-lg border border-border px-3 py-2 min-w-0">
            <p className="text-[10px] text-muted-foreground">Phone</p>
            <a
              href={`tel:${s.phone}`}
              className="font-medium text-primary hover:underline inline-flex items-center gap-1 tabular-nums"
            >
              <Phone className="h-3 w-3" />
              {s.phone}
            </a>
          </div>
          <div className="rounded-lg border border-border px-3 py-2 min-w-0">
            <p className="text-[10px] text-muted-foreground">Email</p>
            {s.email ? (
              <a
                href={`mailto:${s.email}`}
                className="font-medium text-primary hover:underline inline-flex items-center gap-1 max-w-full truncate"
              >
                <Mail className="h-3 w-3 shrink-0" />
                <span className="truncate">{s.email}</span>
              </a>
            ) : (
              <p className="font-medium">—</p>
            )}
          </div>
          <Info
            label="Address"
            value={[s.address, s.city].filter(Boolean).join(", ") || "—"}
          />
          <Info label="Drug licence no." value={s.drugLicenseNo || "—"} mono />
          <Info label="Credit terms" value={`${s.creditDays} days`} />
        </div>

        <section>
          <h3 className="text-[11px] font-semibold text-foreground mb-1.5">
            Recent invoices ({s.invoiceCount} active)
          </h3>
          {recentInvoices.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              No invoices yet.
            </p>
          ) : (
            <div className="rounded-lg border border-border overflow-auto">
              <table className="w-full min-w-[560px] border-collapse text-[11px]">
                <thead>
                  <tr className="bg-muted/60 text-muted-foreground">
                    {[
                      ["Invoice", "text-left"],
                      ["Date", "text-left"],
                      ["Total (₹)", "text-right"],
                      ["Balance (₹)", "text-right"],
                      ["Status", "text-left"],
                    ].map(([label, align]) => (
                      <th
                        key={label}
                        scope="col"
                        className={cn(
                          "px-3 py-2 text-[10px] font-semibold uppercase tracking-wide",
                          align,
                        )}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentInvoices.map((p) => {
                    const meta =
                      PAYMENT_STATUS_META[getPaymentStatus(p, today)];
                    return (
                      <tr key={p.id} className="border-t border-border/60">
                        <td className="px-3 py-2">
                          <CodeChip>{p.invoiceNo}</CodeChip>
                        </td>
                        <td className="px-3 py-2 tabular-nums">
                          {formatISODate(p.invoiceDate)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatPaise(p.totals.netPaise)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium">
                          {formatPaise(getDuePaise(p))}
                        </td>
                        <td className="px-3 py-2">
                          <StatusBadge tone={meta.tone}>
                            {meta.label}
                          </StatusBadge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {recentReturns.length > 0 ? (
          <section>
            <h3 className="text-[11px] font-semibold text-foreground mb-1.5">
              Returns ({s.returnCount})
            </h3>
            <ul className="space-y-1">
              {recentReturns.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-1.5 text-[11px]"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <CodeChip>{r.returnNo}</CodeChip>
                    <span className="text-muted-foreground truncate">
                      {formatISODate(r.date)} · {RETURN_REASONS[r.reason]} ·
                      against {r.invoiceNo}
                    </span>
                  </span>
                  <span className="tabular-nums font-medium">
                    {inrFromPaise(r.totalPaise)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </ModalShell>
  );
}

function Money({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "warn" | "danger" | "good";
}) {
  return (
    <div className="rounded-lg border border-border px-3 py-2 min-w-0">
      <p className="text-[10px] text-muted-foreground truncate">{label}</p>
      <p
        className={cn(
          "text-sm font-bold tabular-nums truncate",
          tone === "warn" && "text-orange-600 dark:text-orange-400",
          tone === "danger" && "text-red-600 dark:text-red-400",
          tone === "good" && "text-emerald-600 dark:text-emerald-400",
        )}
      >
        {inrFromPaise(value)}
      </p>
    </div>
  );
}

function Info({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border px-3 py-2 min-w-0">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "font-medium text-foreground truncate",
          mono && "font-mono",
        )}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}
