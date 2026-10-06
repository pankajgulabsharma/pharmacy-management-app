import { memo, useRef } from "react";
import { cn } from "@/lib/utils";
import { fieldClass, invalidFieldClass } from "@/components/common/formStyles";
import { formatISODate } from "@medicare/domain/lib/date";
import {
  inrFromPaise,
  isMoneyInput,
  paiseToInput,
  parseRupees,
  signedInrFromPaise,
} from "@medicare/domain/lib/money";
import { focusAtEnd } from "@/lib/dom";
import type { PurchaseTotals } from "@medicare/domain/purchases/types";

type Props = {
  totals: PurchaseTotals;
  paid: string;
  paidError?: string;
  dueDate: string;
  creditDays: number | null;
  onPaidChange: (value: string) => void;
  /**
   * Editing an existing invoice: payments are recorded separately, so
   * show what is already paid instead of the "Paid now" input.
   */
  lockedPaidPaise?: number;
  returnedPaise?: number;
};

/**
 * Invoice breakdown + amount paid now.
 * Renders two cards so the parent grid can lay them out side by side.
 */
export const PurchaseTotalsPanel = memo(function PurchaseTotalsPanel({
  totals,
  paid,
  paidError,
  dueDate,
  creditDays,
  onPaidChange,
  lockedPaidPaise,
  returnedPaise = 0,
}: Props) {
  const paidRef = useRef<HTMLInputElement>(null);
  const locked = lockedPaidPaise !== undefined;
  const paidPaise = locked
    ? lockedPaidPaise
    : Math.min(parseRupees(paid) ?? 0, totals.netPaise);
  const balancePaise = Math.max(0, totals.netPaise - paidPaise - returnedPaise);

  return (
    <>
      {/* Breakdown */}
      <div className="rounded-lg border border-border bg-muted/20 px-3 py-2.5 text-[11px] space-y-1">
        <Row
          label={`Items (${totals.lineCount})`}
          value={`${totals.totalQty} + ${totals.totalFreeQty} free`}
        />
        <Row label="Gross" value={inrFromPaise(totals.grossPaise)} />
        <Row
          label="Discount"
          value={
            totals.discountPaise > 0
              ? inrFromPaise(-totals.discountPaise)
              : "₹0.00"
          }
          valueClass={
            totals.discountPaise > 0
              ? "text-emerald-600 dark:text-emerald-400"
              : undefined
          }
        />
        <Row label="Taxable" value={inrFromPaise(totals.taxablePaise)} />
        <Row
          label="CGST + SGST"
          value={`${inrFromPaise(totals.cgstPaise)} + ${inrFromPaise(totals.sgstPaise)}`}
        />
        <Row
          label="Round off"
          value={signedInrFromPaise(totals.roundOffPaise)}
        />
      </div>

      {/* Net + payment */}
      <div className="rounded-lg border border-border bg-muted/20 px-3 py-2.5 text-[11px] space-y-1.5">
        <div className="flex items-baseline justify-between">
          <span className="text-[12px] font-semibold text-foreground">
            Net payable
          </span>
          <span className="text-base font-bold tabular-nums text-foreground">
            {inrFromPaise(totals.netPaise)}
          </span>
        </div>

        {locked ? (
          <div className="space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground">Already paid</span>
              <span className="tabular-nums text-foreground">
                {inrFromPaise(paidPaise)}
              </span>
            </div>
            {returnedPaise > 0 ? (
              <div className="flex items-baseline justify-between">
                <span className="text-muted-foreground">
                  Returned (debit notes)
                </span>
                <span className="tabular-nums text-foreground">
                  {inrFromPaise(returnedPaise)}
                </span>
              </div>
            ) : null}
            <p className="text-[10px] text-muted-foreground">
              Payments are recorded from the invoice's View screen.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <label
                htmlFor="purchase-paid"
                className="text-[11px] font-medium text-foreground"
              >
                Paid now (₹)
              </label>
              <button
                type="button"
                onClick={() => {
                  onPaidChange(paiseToInput(totals.netPaise));
                  focusAtEnd(paidRef.current);
                }}
                disabled={totals.netPaise === 0}
                className="text-[10px] font-medium text-primary hover:underline disabled:opacity-50 disabled:no-underline"
              >
                Pay full
              </button>
            </div>
            <div className="p-0.5">
              <input
                id="purchase-paid"
                ref={paidRef}
                value={paid}
                onChange={(e) => {
                  if (isMoneyInput(e.target.value))
                    onPaidChange(e.target.value);
                }}
                placeholder="0.00"
                inputMode="decimal"
                aria-invalid={Boolean(paidError)}
                className={cn(
                  fieldClass,
                  "tabular-nums",
                  paidError && invalidFieldClass,
                )}
              />
            </div>
            {paidError ? (
              <p className="text-[10px] text-red-500" role="alert">
                {paidError}
              </p>
            ) : null}
          </>
        )}

        <div className="flex items-baseline justify-between gap-2">
          <span className="text-muted-foreground truncate">
            Balance
            {balancePaise > 0 && dueDate
              ? ` · due ${formatISODate(dueDate)}${creditDays !== null ? ` (${creditDays}d)` : ""}`
              : ""}
          </span>
          <span
            className={cn(
              "font-semibold tabular-nums shrink-0",
              balancePaise > 0
                ? "text-orange-600 dark:text-orange-400"
                : "text-emerald-600 dark:text-emerald-400",
            )}
          >
            {inrFromPaise(balancePaise)}
          </span>
        </div>
      </div>
    </>
  );
});

function Row({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("tabular-nums text-foreground", valueClass)}>
        {value}
      </span>
    </div>
  );
}
