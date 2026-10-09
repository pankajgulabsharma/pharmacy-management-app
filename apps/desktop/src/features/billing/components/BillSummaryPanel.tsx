import { memo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { focusAtEnd } from "@/lib/dom";
import {
  inrFromPaise,
  isMoneyInput,
  paiseToInput,
  parseRupees,
  signedInrFromPaise,
} from "@medicare/domain/lib/money";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { Kbd } from "@/components/common/Kbd";
import { KEYS } from "@/app/shortcuts/registry";
import {
  PAYMENT_METHOD_LABELS,
  type PaymentDraft,
  type PaymentMethod,
  type SaleTotals,
} from "@medicare/domain/billing/types";
import type { BillLineView } from "../hooks/useBillingData";
import { tr } from "@/lib/i18n";

type Props = {
  /** Shown when paying by udhaar: the customer account picker */
  udhaarSlot?: React.ReactNode;
  billNo: string;
  /** B2B buyer in another state → IGST */
  interstate?: boolean;
  lines: BillLineView[];
  totals: SaleTotals;
  payment: PaymentDraft;
  onPaymentChange: (p: PaymentDraft) => void;
  /** Why saving is blocked right now, or null */
  blockReason: string | null;
  saving: boolean;
  onSave: (print: boolean) => void;
  onHold: () => void;
  /** Alt+A focuses the amount box of the current payment method */
  amountRef?: (el: HTMLInputElement | null) => void;
};

const METHODS = Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[];

const PAY_INPUT = cn(
  "h-7 w-full rounded-md !text-[10px] leading-none",
  "bg-muted/40 border border-border/50 shadow-none",
  "placeholder:!text-[10px] placeholder:text-muted-foreground",
  "hover:border-border hover:bg-muted/50",
  "focus-visible:outline-none focus-visible:ring-1",
  "focus-visible:ring-ring focus-visible:border-border",
  "focus-visible:bg-background",
);

export const BillSummaryPanel = memo(function BillSummaryPanel({
  udhaarSlot,
  billNo,
  interstate = false,
  lines,
  totals,
  payment,
  onPaymentChange,
  blockReason,
  saving,
  onSave,
  onHold,
  amountRef,
}: Props) {
  const { t } = useTranslation();
  const receivedRef = useRef<HTMLInputElement | null>(null);
  // One ref for both the local "Exact amount" button and the Alt+A shortcut
  const setReceived = (el: HTMLInputElement | null) => {
    receivedRef.current = el;
    amountRef?.(el);
  };
  const net = totals.netPaise;

  const set = (patch: Partial<PaymentDraft>) =>
    onPaymentChange({ ...payment, ...patch });
  const setSplit = (key: keyof PaymentDraft["split"], v: string) => {
    if (isMoneyInput(v)) set({ split: { ...payment.split, [key]: v } });
  };

  const received = parseRupees(payment.received) ?? 0;
  const changeDue = Math.max(0, received - net);
  const splitSum = (["cash", "upi", "card"] as const).reduce(
    (s, k) => s + (parseRupees(payment.split[k]) ?? 0),
    0,
  );
  const splitLeft = net - splitSum;
  const canSave = !blockReason && !saving;

  return (
    <div className="h-full flex flex-col gap-2 overflow-hidden">
      {/* Summary */}
      <div className="bg-card border border-border rounded-lg p-2.5 flex-[52] min-h-0 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-border/60 shrink-0">
          <h3 className="text-[11px] font-semibold text-foreground">
            {t("billing.billSummary")}
          </h3>
          <div className="flex items-center gap-1.5">
            <span
              className="text-[9px] text-muted-foreground font-mono"
              title="Number this bill will get"
            >
              {billNo}
            </span>
            <StatusBadge tone="caution" size="xs">
              {t("billing.draft")}
            </StatusBadge>
          </div>
        </div>

        {lines.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={t("billing.noItems")}
            description={t("billing.noItemsHint")}
            compact
            bordered={false}
          />
        ) : (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto space-y-1 mb-1.5 min-h-0">
              {lines.map(({ line, medicine, amounts, error }) => (
                <div
                  key={line.lineId}
                  className="flex items-start justify-between gap-2 text-[10px]"
                >
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "font-medium truncate",
                        error ? "text-red-600" : "text-foreground",
                      )}
                    >
                      {medicine?.name ?? "Unknown"}
                    </p>
                    <p className="text-[9px] text-muted-foreground">
                      {[
                        line.qtyStrip
                          ? `${line.qtyStrip} ${medicine?.unit ?? ""}`
                          : "",
                        line.qtyLoose ? `${line.qtyLoose} LSE` : "",
                      ]
                        .filter(Boolean)
                        .join(" + ")}
                      {line.discountPercent > 0
                        ? ` · ${line.discountPercent}% off`
                        : ""}
                    </p>
                  </div>
                  <span className="tabular-nums font-medium shrink-0">
                    {inrFromPaise(amounts.amountPaise)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-border pt-1.5 space-y-0.5 text-[10px] shrink-0">
              <Row label="Subtotal" value={inrFromPaise(totals.grossPaise)} />
              {totals.discountPaise > 0 ? (
                <Row
                  label="Discount"
                  value={inrFromPaise(-totals.discountPaise)}
                  valueClass="text-emerald-600 dark:text-emerald-400"
                />
              ) : null}
              {interstate ? (
                <Row
                  label="GST included (IGST — other state)"
                  value={inrFromPaise(totals.gstPaise)}
                  valueClass="text-muted-foreground"
                />
              ) : (
                <Row
                  label="GST included (CGST + SGST)"
                  value={`${inrFromPaise(totals.cgstPaise)} + ${inrFromPaise(totals.sgstPaise)}`}
                  valueClass="text-muted-foreground"
                />
              )}
              <Row
                label="Round off"
                value={signedInrFromPaise(totals.roundOffPaise)}
              />
              <div className="flex justify-between text-[12px] font-bold text-primary pt-0.5">
                <span>Total</span>
                <span className="tabular-nums">{inrFromPaise(net)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Payment */}
      <div className="bg-card border border-border rounded-lg p-2.5 flex-[48] min-h-0 flex flex-col overflow-hidden">
        <h3 className="text-[11px] font-semibold text-foreground shrink-0 mb-1.5 flex items-center justify-between">
          {t("billing.paymentMethod")}
          <span className="inline-flex items-center gap-1 text-[9px] font-normal text-muted-foreground">
            <Kbd keys={KEYS.nextPayment} /> {tr("change")}
          </span>
        </h3>
        <div
          className="grid grid-cols-3 gap-1 shrink-0 mb-1.5"
          role="radiogroup"
          aria-label="Payment method"
        >
          {METHODS.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={payment.method === m}
              onClick={() => set({ method: m })}
              className={cn(
                "rounded-md border px-1 py-1.5 text-[9px] font-medium transition-colors",
                payment.method === m
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              {tr(PAYMENT_METHOD_LABELS[m])}
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto mb-1.5 p-0.5">
          {payment.method === "cash" && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="bill-received"
                  className="text-[9px] text-muted-foreground"
                >
                  {tr("Received (₹)")}{" "}
                  <Kbd keys={KEYS.payAmount} className="ml-1 align-middle" />
                </label>
                <button
                  type="button"
                  disabled={net === 0}
                  onClick={() => {
                    set({ received: paiseToInput(net) });
                    focusAtEnd(receivedRef.current);
                  }}
                  className="text-[9px] font-medium text-primary hover:underline disabled:opacity-50"
                >
                  {tr("Exact amount")}
                </button>
              </div>
              <Input
                id="bill-received"
                ref={setReceived}
                value={payment.received}
                onChange={(e) => {
                  if (isMoneyInput(e.target.value))
                    set({ received: e.target.value });
                }}
                placeholder={tr("Exact {{amount}} — leave empty", {
                  amount: inrFromPaise(net),
                })}
                className={PAY_INPUT}
                inputMode="decimal"
              />
              <div className="flex justify-between text-[10px]">
                <span className="text-muted-foreground">
                  {tr("Change to return")}
                </span>
                <span className="font-semibold tabular-nums">
                  {inrFromPaise(changeDue)}
                </span>
              </div>
            </div>
          )}

          {(payment.method === "upi" || payment.method === "card") && (
            <div className="space-y-1">
              <p className="text-[9px] text-muted-foreground">
                {payment.method === "upi" ? "Collect" : "Charge"}{" "}
                <span className="font-semibold text-foreground">
                  {inrFromPaise(net)}
                </span>{" "}
                via {PAYMENT_METHOD_LABELS[payment.method]}
              </p>
              <Input
                ref={amountRef}
                value={payment.reference}
                maxLength={40}
                onChange={(e) => set({ reference: e.target.value })}
                placeholder={
                  payment.method === "upi"
                    ? "UTR / ref no. (optional)"
                    : "Approval code (optional)"
                }
                className={PAY_INPUT}
              />
            </div>
          )}

          {payment.method === "wallet" && (
            <p className="text-[9px] text-muted-foreground pt-1">
              Wallet debit{" "}
              <span className="font-semibold text-foreground">
                {inrFromPaise(net)}
              </span>
            </p>
          )}

          {payment.method === "udhaar" ? udhaarSlot : null}

          {payment.method === "split" && (
            <div className="space-y-1">
              <p className="text-[9px] text-muted-foreground">
                {splitLeft >= 0 ? "Left" : "Over by"}{" "}
                <span
                  className={cn(
                    "font-semibold",
                    splitLeft === 0 ? "text-emerald-600" : "text-orange-600",
                  )}
                >
                  {inrFromPaise(Math.abs(splitLeft))}
                </span>
              </p>
              {(["cash", "upi", "card"] as const).map((k) => (
                <div key={k} className="flex items-center gap-1.5">
                  <span className="text-[9px] text-muted-foreground w-8 shrink-0 capitalize">
                    {k}
                  </span>
                  <Input
                    ref={k === "cash" ? amountRef : undefined}
                    value={payment.split[k]}
                    onChange={(e) => setSplit(k, e.target.value)}
                    placeholder="0"
                    aria-label={`Split ${k} amount`}
                    className={PAY_INPUT}
                    inputMode="decimal"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1.5 shrink-0">
          {blockReason && lines.length > 0 ? (
            <p
              className="text-[9px] text-orange-600 dark:text-orange-400 leading-tight"
              role="status"
            >
              {blockReason}
            </p>
          ) : null}
          <Button
            type="button"
            disabled={!canSave}
            onClick={() => onSave(true)}
            title="Save & print (F9)"
            className="w-full h-8 rounded-md text-[11px] bg-primary text-primary-foreground disabled:opacity-50 gap-2"
          >
            {t("billing.savePrint")}
            {lines.length > 0 ? ` · ${inrFromPaise(net)}` : ""}
            <Kbd keys={KEYS.savePrintBill} tone="light" />
          </Button>
          <div className="grid grid-cols-2 gap-1">
            <Button
              type="button"
              variant="outline"
              disabled={lines.length === 0 || saving}
              onClick={onHold}
              className="h-7 rounded-md text-[9px] border-border gap-1"
            >
              {t("billing.holdBill")}
              <Kbd keys={KEYS.holdBill} />
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!canSave}
              onClick={() => onSave(false)}
              className="h-7 rounded-md text-[9px] border-border gap-1"
            >
              {t("billing.saveNoPrint")}
              <Kbd keys={KEYS.saveBill} />
            </Button>
          </div>
        </div>
      </div>
    </div>
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
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{tr(label)}</span>
      <span className={cn("tabular-nums", valueClass)}>{value}</span>
    </div>
  );
}
