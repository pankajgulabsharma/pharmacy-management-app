import { useId, useMemo } from "react";
import { ModalShell } from "@/components/common/ModalShell";
import { DialogCloseButton } from "@/components/common/DialogCloseButton";
import { CodeChip } from "@/components/common/CodeChip";
import { cn } from "@/lib/utils";
import { formatPaise, inrFromPaise } from "@/lib/money";
import { tr } from "@/lib/i18n";
import { useSalesStore } from "@/features/billing/store/useSalesStore";
import { useCustomerStore } from "../store/useCustomerStore";
import { customerLedger } from "../utils/ledger";
import type { Customer } from "../types";

type Props = {
  customer: Customer | null;
  onClose: () => void;
};

const when = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const KIND = {
  bill: "Udhaar bill",
  return: "Return adjusted",
  payment: "Payment received",
} as const;

/** Full khata: every udhaar bill, return and payment with running balance */
/** Statement only — Receive and Edit are their own buttons on the list */
export function CustomerStatementDialog({ customer, onClose }: Props) {
  const titleId = useId();
  const sales = useSalesStore((s) => s.sales);
  const saleReturns = useSalesStore((s) => s.saleReturns);
  const payments = useCustomerStore((s) => s.payments);
  const entries = useMemo(
    () =>
      customer ? customerLedger(customer.id, sales, saleReturns, payments) : [],
    [customer, sales, saleReturns, payments],
  );
  if (!customer) return null;
  const balance = entries.at(-1)?.balancePaise ?? 0;

  return (
    <ModalShell
      open
      onClose={onClose}
      labelledBy={titleId}
      className="max-w-3xl max-h-[88vh] flex flex-col overflow-hidden"
    >
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-3.5 shrink-0">
        <div className="min-w-0">
          <h2 id={titleId} className="text-sm font-semibold truncate">
            {customer.name}
          </h2>
          <p className="text-[11px] text-muted-foreground">
            {customer.phone || tr("No mobile")} ·{" "}
            {customer.creditLimitPaise
              ? `${tr("Limit")} ${inrFromPaise(customer.creditLimitPaise)}`
              : tr("No limit")}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right mr-1">
            <p className="text-[10px] text-muted-foreground">
              {tr("Owes now")}
            </p>
            <p
              className={cn(
                "text-lg font-bold tabular-nums",
                balance > 0
                  ? "text-red-600 dark:text-red-400"
                  : "text-emerald-600",
              )}
            >
              {inrFromPaise(balance)}
            </p>
          </div>
          <DialogCloseButton onClick={onClose} />
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {entries.length === 0 ? (
          <p className="p-10 text-center text-[12px] text-muted-foreground">
            {tr("No udhaar yet on this account.")}
          </p>
        ) : (
          <table className="w-full text-[11px] border-collapse">
            <thead className="sticky top-0 z-10">
              <tr>
                {[
                  "Date & time",
                  "Entry",
                  "Ref",
                  "Udhaar (₹)",
                  "Received (₹)",
                  "Balance (₹)",
                ].map((h, i) => (
                  <th
                    key={h}
                    className={cn(
                      "h-9 px-3 bg-primary text-primary-foreground text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap",
                      i >= 3 ? "text-right" : "text-left",
                    )}
                  >
                    {tr(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...entries].reverse().map((e, i) => (
                <tr
                  key={e.id}
                  className={cn(
                    "border-b border-border/60 [&>td]:align-middle",
                    i % 2 === 1 && "bg-muted/20",
                  )}
                >
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground tabular-nums">
                    {when.format(new Date(e.at))}
                  </td>
                  <td className="px-3 py-2">
                    {tr(KIND[e.kind])}
                    <span className="block text-[10px] text-muted-foreground">
                      {e.note}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <CodeChip>{e.ref}</CodeChip>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-red-600 dark:text-red-400">
                    {e.debitPaise ? formatPaise(e.debitPaise) : ""}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-emerald-600">
                    {e.creditPaise ? formatPaise(e.creditPaise) : ""}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">
                    {formatPaise(e.balancePaise)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="border-t border-border px-5 py-2 text-[10px] text-muted-foreground shrink-0">
        {tr("Newest first")}
      </p>
    </ModalShell>
  );
}
